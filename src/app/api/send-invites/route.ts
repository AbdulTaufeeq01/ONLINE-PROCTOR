import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resend, EMAIL_FROM, buildInviteEmailHtml } from '@/lib/resend';
import { ExamInvite, Exam } from '@/types/database';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { exam_id, students } = await request.json();

    if (!exam_id || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request body. exam_id and students array required.' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Step 1: Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Step 2: Fetch and verify exam ownership
    const { data: exam, error: examError } = await (supabase.from('exams') as any)
      .select('*')
      .eq('id', exam_id)
      .eq('teacher_id', user.id)
      .single() as { data: Exam | null; error: any };

    if (examError || !exam) {
      return NextResponse.json(
        { error: 'Exam not found or you do not have permission to invite students' },
        { status: 403 }
      );
    }

    // Step 3: Create invites and send emails
    const createdInvites: ExamInvite[] = [];

    for (const student of students) {
      try {
        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');

        // Insert into exam_invites table
        const { data: invite, error: insertError } = await (supabase.from('exam_invites') as any)
          .insert({
            exam_id,
            student_email: student.email,
            student_name: student.name || null,
            token,
            used: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Failed to insert invite for ${student.email}:`, insertError);
          continue;
        }

        // Send email via Resend
        const joinLink = `${process.env.NEXT_PUBLIC_APP_URL}/join/${token}`;
        const emailHtml = buildInviteEmailHtml({
          studentName: student.name || 'Student',
          examTitle: exam.title,
          durationMinutes: exam.duration_minutes || 60,
          joinUrl: joinLink
        });

        const emailResponse = await resend.emails.send({
          from: EMAIL_FROM,
          to: student.email,
          subject: `You are invited to: ${exam.title}`,
          html: emailHtml,
        });

        if (emailResponse.error) {
          console.error(`Failed to send email to ${student.email}:`, emailResponse.error);
          // Continue anyway - invite was created, just email failed
        }

        createdInvites.push(invite);
      } catch (studentError) {
        console.error(`Error processing student ${student.email}:`, studentError);
        continue;
      }
    }

    // Step 4: Return response
    return NextResponse.json(
      {
        success: true,
        invites: createdInvites,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in send-invites API route:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
