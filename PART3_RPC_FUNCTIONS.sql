-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC FUNCTIONS FOR ONLINE PROCTORING SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════
-- Execute these in the Supabase SQL editor to create all required RPC functions
-- All functions use SECURITY DEFINER to bypass RLS policies
-- ═══════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 1: insert_behavior_log
-- Called by: /api/flag-event
-- Purpose: Log proctoring behavior events (tab switches, face tracking, etc.)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION insert_behavior_log(
  p_session_id uuid,
  p_student_id uuid,
  p_exam_id uuid,
  p_event_type_param text,
  p_confidence_param numeric,
  p_metadata_param jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO behavior_logs (
    session_id,
    student_id,
    exam_id,
    event_type,
    confidence,
    metadata,
    created_at
  ) VALUES (
    p_session_id,
    p_student_id,
    p_exam_id,
    p_event_type_param,
    p_confidence_param,
    p_metadata_param,
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'created_at', now()
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 2: insert_flag
-- Called by: /api/flag-event
-- Purpose: Create security flag for suspicious behavior
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION insert_flag(
  p_session_id uuid,
  p_student_id uuid,
  p_exam_id uuid,
  p_flag_type_param text,
  p_severity_param text,
  p_metadata_param jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag_id uuid;
BEGIN
  INSERT INTO flags (
    session_id,
    student_id,
    exam_id,
    flag_type,
    severity,
    metadata,
    created_at
  ) VALUES (
    p_session_id,
    p_student_id,
    p_exam_id,
    p_flag_type_param,
    p_severity_param,
    p_metadata_param,
    now()
  )
  RETURNING id INTO v_flag_id;

  RETURN jsonb_build_object(
    'success', true,
    'flag_id', v_flag_id,
    'flag_type', p_flag_type_param,
    'severity', p_severity_param,
    'created_at', now()
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 3: get_exam_questions
-- Called by: /api/submit-exam, /api/grade-answers, exam page
-- Purpose: Fetch all questions for an exam in order
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_exam_questions(
  p_exam_id uuid
)
RETURNS TABLE (
  id uuid,
  exam_id uuid,
  question_text text,
  question_type text,
  type text,
  options jsonb,
  correct_answer text,
  marks numeric,
  max_marks numeric,
  grading_hint text,
  order_index numeric,
  position numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.exam_id,
    q.question_text,
    q.type as question_type,
    q.type,
    q.options,
    q.correct_answer,
    q.marks,
    q.marks as max_marks,
    q.grading_hint,
    q.order_index,
    q.order_index as position
  FROM questions q
  WHERE q.exam_id = p_exam_id
  ORDER BY q.order_index ASC;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 4: submit_exam_session
-- Called by: /api/submit-exam (final submission)
-- Purpose: Update session with final score and grading details
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION submit_exam_session(
  p_session_id uuid,
  p_score_param numeric,
  p_max_score_param numeric,
  p_status_param text,
  p_answers_param jsonb,
  p_grading_details_param jsonb,
  p_submitted_at timestamp
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  -- Verify session exists and is in progress
  SELECT * INTO v_session FROM exam_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found'
    );
  END IF;

  IF v_session.status != 'in_progress' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session is not actively in progress'
    );
  END IF;

  -- Update session
  UPDATE exam_sessions
  SET
    score = p_score_param,
    max_score = p_max_score_param,
    status = p_status_param,
    answers = p_answers_param,
    grading_details = p_grading_details_param,
    submitted_at = p_submitted_at
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'score', p_score_param,
    'max_score', p_max_score_param,
    'submitted_at', p_submitted_at
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 5: update_exam_answers
-- Called by: useAutoSave hook via /api/submit-exam (with auto_save: true)
-- Purpose: Auto-save answers WITHOUT updating score or status
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_exam_answers(
  p_session_id uuid,
  p_answers_param jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  -- Verify session exists and is in progress
  SELECT * INTO v_session FROM exam_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found'
    );
  END IF;

  IF v_session.status != 'in_progress' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot save answers to non-active session'
    );
  END IF;

  -- Update only answers, preserve score/status/grading_details
  UPDATE exam_sessions
  SET answers = p_answers_param
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'answers_saved_at', now()
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 6: create_exam_session
-- Called by: /join/[token] page (when student clicks join link)
-- Purpose: Atomically create session and mark invite as used
-- Must check: invite not already used, exam exists, exam is active
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_exam_session(
  p_exam_id uuid,
  p_student_id uuid,
  p_invite_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_exam record;
  v_session_id uuid;
BEGIN
  -- Step 1: Verify invite exists and hasn't been used
  SELECT * INTO v_invite FROM exam_invites WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invite not found'
    );
  END IF;

  IF v_invite.used THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invite has been used already'
    );
  END IF;

  IF v_invite.exam_id != p_exam_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invite does not match exam'
    );
  END IF;

  -- Step 2: Verify exam exists and is active
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Exam not found'
    );
  END IF;

  IF v_exam.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Exam is not active'
    );
  END IF;

  -- Step 3: Create session (atomic with invite update)
  BEGIN
    INTO v_session_id FROM exam_sessions WHERE exam_id = p_exam_id AND student_id = p_student_id AND status = 'in_progress';

    -- If session already exists for this student in this exam, reuse it
    IF FOUND THEN
      UPDATE exam_invites SET used = true WHERE id = p_invite_id;
      RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'created_at', now(),
        'note', 'Reused existing session'
      );
    END IF;

    -- Create new session
    INSERT INTO exam_sessions (
      exam_id,
      student_id,
      invite_id,
      started_at,
      status,
      answers
    ) VALUES (
      p_exam_id,
      p_student_id,
      p_invite_id,
      now(),
      'not_started',
      '{}'::jsonb
    )
    RETURNING id INTO v_session_id;

    -- Mark invite as used
    UPDATE exam_invites SET used = true WHERE id = p_invite_id;

    RETURN jsonb_build_object(
      'success', true,
      'session_id', v_session_id,
      'created_at', now()
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
  END;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 7: get_teacher_exams_with_counts
-- Called by: /teacher/home page
-- Purpose: Fetch exams with question and session counts
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_teacher_exams_with_counts(
  p_teacher_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  status text,
  duration_minutes numeric,
  pass_marks numeric,
  created_at timestamp,
  updated_at timestamp,
  teacher_id uuid,
  question_count bigint,
  session_count bigint,
  submitted_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.status,
    e.duration_minutes,
    e.pass_marks,
    e.created_at,
    e.updated_at,
    e.teacher_id,
    COUNT(DISTINCT q.id) as question_count,
    COUNT(DISTINCT es.id) as session_count,
    COUNT(DISTINCT CASE WHEN es.status = 'submitted' THEN es.id END) as submitted_count
  FROM exams e
  LEFT JOIN questions q ON q.exam_id = e.id
  LEFT JOIN exam_sessions es ON es.exam_id = e.id
  WHERE e.teacher_id = p_teacher_id
  GROUP BY e.id, e.title, e.description, e.status, e.duration_minutes, e.pass_marks, e.created_at, e.updated_at, e.teacher_id
  ORDER BY e.created_at DESC;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 8: get_exam_with_sessions
-- Called by: /teacher/exam/[id]/monitor
-- Purpose: Fetch exam details with verification that teacher owns it
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_exam_with_sessions(
  p_exam_id uuid,
  p_teacher_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam record;
BEGIN
  -- Verify teacher owns this exam
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id AND teacher_id = p_teacher_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Exam not found or access denied'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'exam', to_jsonb(v_exam)
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 9: get_session_report_data
-- Called by: /api/generate-report and report-generator.ts
-- Purpose: Fetch complete session data for report generation
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_session_report_data(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_exam record;
  v_student record;
  v_questions jsonb;
  v_flags jsonb;
  v_behavior_logs jsonb;
  v_result jsonb;
BEGIN
  -- Fetch session
  SELECT * INTO v_session FROM exam_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Session not found');
  END IF;

  -- Fetch exam
  SELECT * INTO v_exam FROM exams WHERE id = v_session.exam_id;

  -- Fetch student profile
  SELECT * INTO v_student FROM profiles WHERE id = v_session.student_id;

  -- Fetch questions
  SELECT jsonb_agg(q.*) INTO v_questions
  FROM questions q
  WHERE q.exam_id = v_session.exam_id
  ORDER BY q.order_index ASC;

  -- Fetch flags
  SELECT jsonb_agg(f.*) INTO v_flags
  FROM flags f
  WHERE f.session_id = p_session_id;

  -- Fetch behavior logs
  SELECT jsonb_agg(bl.*) INTO v_behavior_logs
  FROM behavior_logs bl
  WHERE bl.session_id = p_session_id;

  v_result := jsonb_build_object(
    'session', to_jsonb(v_session),
    'exam', to_jsonb(v_exam),
    'student', to_jsonb(v_student),
    'questions', COALESCE(v_questions, '[]'::jsonb),
    'flags', COALESCE(v_flags, '[]'::jsonb),
    'behavior_logs', COALESCE(v_behavior_logs, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- RPC 10: update_session_ai_report
-- Called by: /api/grade-answers (after AI grading completes)
-- Purpose: Update session with AI analysis report, cheating score, and final grading
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_session_ai_report(
  p_session_id uuid,
  p_ai_report_param text,
  p_cheating_score_param numeric,
  p_grading_details_param jsonb,
  p_final_score_param numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE exam_sessions
  SET
    ai_report = p_ai_report_param,
    cheating_score = p_cheating_score_param,
    grading_details = p_grading_details_param,
    score = p_final_score_param,
    updated_at = now()
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'ai_report_updated', true,
    'cheating_score', p_cheating_score_param,
    'final_score', p_final_score_param,
    'updated_at', now()
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- ADDITIONAL UTILITY RPC FUNCTIONS (if they don't exist)
-- ════════════════════════════════════════════════════════════════════════════════

-- These may already exist in your Supabase - check before creating

CREATE OR REPLACE FUNCTION get_profile(
  p_profile_id_param uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamp,
  updated_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.email,
    p.full_name,
    p.role,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.id = p_profile_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION get_exam_by_id(
  p_exam_id_param uuid
)
RETURNS TABLE (
  id uuid,
  teacher_id uuid,
  title text,
  description text,
  status text,
  duration_minutes numeric,
  pass_marks numeric,
  created_at timestamp,
  updated_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.teacher_id,
    e.title,
    e.description,
    e.status,
    e.duration_minutes,
    e.pass_marks,
    e.created_at,
    e.updated_at
  FROM exams e
  WHERE e.id = p_exam_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION get_student_sessions(
  p_student_id_param uuid
)
RETURNS TABLE (
  id uuid,
  exam_id uuid,
  student_id uuid,
  invite_id uuid,
  started_at timestamp,
  submitted_at timestamp,
  status text,
  answers jsonb,
  score numeric,
  max_score numeric,
  cheating_score numeric,
  ai_report text,
  grading_details jsonb,
  created_at timestamp,
  updated_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    es.id,
    es.exam_id,
    es.student_id,
    es.invite_id,
    es.started_at,
    es.submitted_at,
    es.status,
    es.answers,
    es.score,
    es.max_score,
    es.cheating_score,
    es.ai_report,
    es.grading_details,
    es.created_at,
    es.updated_at
  FROM exam_sessions es
  WHERE es.student_id = p_student_id_param
  ORDER BY es.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_invite_by_token(
  p_token_param text
)
RETURNS TABLE (
  id uuid,
  exam_id uuid,
  student_email text,
  student_name text,
  token text,
  used boolean,
  created_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ei.id,
    ei.exam_id,
    ei.student_email,
    ei.student_name,
    ei.token,
    ei.used,
    ei.created_at
  FROM exam_invites ei
  WHERE ei.token = p_token_param;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF RPC FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════════
