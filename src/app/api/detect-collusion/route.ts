import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SessionAnswers {
  session_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  answers: Record<string, string>;
  submitted_at: string | null;
}

interface CollusionPair {
  student_a_id: string;
  student_a_name: string;
  student_b_id: string;
  student_b_name: string;
  similarity_score: number; // 0-100
  matching_questions: number;
  total_questions: number;
  matched_question_ids: string[];
  severity: "low" | "medium" | "high";
}

interface CollusionResult {
  exam_id: string;
  total_sessions: number;
  pairs_analyzed: number;
  suspicious_pairs: CollusionPair[];
  collusion_detected: boolean;
  summary: string;
}

/**
 * Compute Jaccard-style answer similarity between two answer maps.
 * Only compares questions answered by BOTH students.
 */
function computeAnswerSimilarity(
  answersA: Record<string, string>,
  answersB: Record<string, string>
): {
  similarity: number;
  matchingQuestions: number;
  totalCompared: number;
  matchedIds: string[];
} {
  const keysA = new Set(Object.keys(answersA));
  const keysB = new Set(Object.keys(answersB));

  // Questions answered by both
  const commonKeys = [...keysA].filter((k) => keysB.has(k));

  if (commonKeys.length === 0) {
    return { similarity: 0, matchingQuestions: 0, totalCompared: 0, matchedIds: [] };
  }

  const matchedIds: string[] = [];

  for (const qId of commonKeys) {
    const a = (answersA[qId] ?? "").trim().toLowerCase();
    const b = (answersB[qId] ?? "").trim().toLowerCase();

    if (a === "" || b === "") continue; // skip unanswered

    if (a === b) {
      matchedIds.push(qId);
    }
  }

  const totalCompared = commonKeys.filter(
    (k) =>
      (answersA[k] ?? "").trim() !== "" && (answersB[k] ?? "").trim() !== ""
  ).length;

  const similarity =
    totalCompared > 0
      ? Math.round((matchedIds.length / totalCompared) * 100)
      : 0;

  return {
    similarity,
    matchingQuestions: matchedIds.length,
    totalCompared,
    matchedIds,
  };
}

function getSeverity(score: number): "low" | "medium" | "high" {
  if (score >= 85) return "high";
  if (score >= 70) return "medium";
  return "low";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { exam_id, threshold = 70 } = body;

    if (!exam_id) {
      return NextResponse.json(
        { error: "exam_id is required" },
        { status: 400 }
      );
    }

    // Verify teacher owns this exam
    const { data: examData, error: examError } = await supabase.rpc(
      "get_teacher_exam",
      { exam_id_param: exam_id, teacher_id_param: user.id }
    );

    if (examError || !examData) {
      return NextResponse.json(
        { error: "Exam not found or access denied" },
        { status: 404 }
      );
    }

    // Fetch all submitted sessions for this exam
    const { data: sessionsRaw, error: sessionsError } = await supabase.rpc(
      'get_exam_sessions_for_collusion',
      { exam_id_param: exam_id }
    );

    if (sessionsError) {
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 500 }
      );
    }

    const sessions: SessionAnswers[] = (sessionsRaw ?? []).filter(
      (s: SessionAnswers) => s.answers && Object.keys(s.answers).length > 0
    );

    if (sessions.length < 2) {
      return NextResponse.json<CollusionResult>({
        exam_id,
        total_sessions: sessions.length,
        pairs_analyzed: 0,
        suspicious_pairs: [],
        collusion_detected: false,
        summary: "Not enough submissions to analyze collusion.",
      });
    }

    // Compare every pair of students (O(n²))
    const suspiciousPairs: CollusionPair[] = [];
    let pairsAnalyzed = 0;

    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const sa = sessions[i];
        const sb = sessions[j];

        const { similarity, matchingQuestions, totalCompared, matchedIds } =
          computeAnswerSimilarity(sa.answers, sb.answers);

        pairsAnalyzed++;

        if (similarity >= threshold && totalCompared >= 3) {
          suspiciousPairs.push({
            student_a_id: sa.student_id,
            student_a_name: sa.student_name ?? "Unknown",
            student_b_id: sb.student_id,
            student_b_name: sb.student_name ?? "Unknown",
            similarity_score: similarity,
            matching_questions: matchingQuestions,
            total_questions: totalCompared,
            matched_question_ids: matchedIds,
            severity: getSeverity(similarity),
          });
        }
      }
    }

    // Sort by similarity descending
    suspiciousPairs.sort((a, b) => b.similarity_score - a.similarity_score);

    const highCount = suspiciousPairs.filter((p) => p.severity === "high").length;
    const mediumCount = suspiciousPairs.filter(
      (p) => p.severity === "medium"
    ).length;

    let summary = `Analyzed ${pairsAnalyzed} student pairs. `;
    if (suspiciousPairs.length === 0) {
      summary += "No suspicious similarity detected.";
    } else {
      summary += `Found ${suspiciousPairs.length} suspicious pair(s): ${highCount} high, ${mediumCount} medium severity.`;
    }

    // Persist suspicious pairs as flags in the database
    for (const pair of suspiciousPairs) {
      const sessionA = sessions.find((s) => s.student_id === pair.student_a_id);
      if (sessionA) {
        await supabase.rpc('insert_flag', {
          session_id_param: sessionA.session_id,
          student_id_param: pair.student_a_id,
          exam_id_param: exam_id,
          flag_type_param: 'collusion_suspected',
          severity_param: pair.severity,
          metadata_param: {
            similarity_score: pair.similarity_score,
            compared_with: pair.student_b_id,
            compared_with_name: pair.student_b_name,
            matching_questions: pair.matching_questions,
            total_questions: pair.total_questions,
          },
        });
      }
    }

    return NextResponse.json<CollusionResult>({
      exam_id,
      total_sessions: sessions.length,
      pairs_analyzed: pairsAnalyzed,
      suspicious_pairs: suspiciousPairs,
      collusion_detected: suspiciousPairs.length > 0,
      summary,
    });
  } catch (err) {
    console.error("detect-collusion error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}