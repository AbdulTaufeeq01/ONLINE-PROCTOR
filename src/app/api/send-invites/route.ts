import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import crypto from 'crypto';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', exam_id)
      .eq('teacher_id', user.id)
      .single();

    if (examError || !exam) {
      return NextResponse.json(
        { error: 'Exam not found or you do not have permission to invite students' },
        { status: 403 }
      );
    }

    // Step 3: Create invites and send emails
    const createdInvites = [];

    for (const student of students) {
      try {
        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');

        // Insert into exam_invites table
        const { data: invite, error: insertError } = await supabase
          .from('exam_invites')
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
        const studentGreeting = student.name ? `Hi ${student.name}` : 'Hello';

        const emailHtml = `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>${studentGreeting},</h2>
                <p>You have been invited to take the exam:</p>
                <h3 style="color: #4f46e5;">${exam.title}</h3>
                <p>Click the link below to join and begin the exam:</p>
                <a href="${joinLink}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
                  Join Exam
                </a>
                <p style="margin-top: 20px;">
                  Or copy this link: <br/>
                  <code style="background: #f5f5f5; padding: 8px; display: inline-block; margin-top: 8px;">
                    ${joinLink}
                  </code>
                </p>
                <p style="margin-top: 20px; font-size: 14px; color: #666;">
                  <strong>Important:</strong> This invitation link can only be used once. 
                  Please use it carefully and keep it private.
                </p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;" />
                <p style="font-size: 12px; color: #999;">
                  ProctorApp © 2026. All rights reserved.
                </p>
              </div>
            </body>
          </html>
        `;

        const emailResponse = await resend.emails.send({
          from: 'ProctorApp <onboarding@resend.dev>',
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
