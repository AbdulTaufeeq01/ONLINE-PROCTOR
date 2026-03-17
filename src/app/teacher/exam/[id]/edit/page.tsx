'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TeacherNavbar from '@/components/layout/TeacherNavbar';
import QuestionEditor from '@/components/exam/QuestionEditor';

interface Exam {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'ended';
  duration_minutes: number;
}

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  order_index: number;
  type: 'mcq' | 'short_answer' | 'long_answer';
  question_text: string;
  options: QuestionOption[] | null;
  correct_answer: string;
  marks: number;
  grading_hint: string | null;
}

export default function ExamEditPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);

  // Fetch exam and questions on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        
        if (!currentUser) {
          toast.error('Not authenticated');
          router.push('/auth/login');
          return;
        }

        setUserId(currentUser.id);

        // Fetch exam
        const examCall = supabase.rpc('get_teacher_exam', {
          exam_id_param: examId,
          teacher_id_param: currentUser.id
        } as any) as any
        const { data: examData } = await examCall

        const exam = examData?.[0] ?? null

        if (!exam) {
          toast.error('Failed to load exam');
          router.push('/teacher/home');
          return;
        }

        setExam(exam);

        // Fetch questions
        const questionsCall = supabase
          .rpc('get_exam_questions', {
            exam_id_param: examData[0]?.id ?? examId
          } as any) as any
        const { data: questionsData, error: questionsError } = await questionsCall

        if (questionsError) {
          console.error('Error fetching questions:', questionsError);
          setQuestions([]);
        } else {
          setQuestions(questionsData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('An error occurred while loading');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [examId, supabase, router]);

  const handleActivateExam = async () => {
    if (questions.length === 0) {
      toast.error('Please add at least one question before activating the exam');
      return;
    }

    setIsActivating(true);
    try {
      const { error } = await (supabase
        .from('exams') as any)
        .update({ status: 'active' })
        .eq('id', examId);

      if (error) {
        toast.error('Failed to activate exam');
        return;
      }

      setExam((prev) => (prev ? { ...prev, status: 'active' } : null));
      toast.success('Exam activated successfully');
    } catch (error) {
      console.error('Error activating exam:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <TeacherNavbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (!exam) {
    return (
      <main className="min-h-screen bg-gray-50">
        <TeacherNavbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Exam not found</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <TeacherNavbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link and Header */}
        <div className="mb-8">
          <Link href="/teacher/home" className="text-indigo-600 hover:text-indigo-700 font-medium mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">{exam.title}</h1>
              <p className="text-gray-600 mt-2">Duration: {exam.duration_minutes} minutes</p>
            </div>
            {exam.status === 'draft' && (
              <Button
                onClick={handleActivateExam}
                disabled={isActivating}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2"
              >
                {isActivating ? 'Activating...' : 'Activate Exam'}
              </Button>
            )}
            {exam.status !== 'draft' && (
              <Badge className={exam.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}>
                {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
              </Badge>
            )}
          </div>
        </div>

        {/* Two Panel Layout */}
        <QuestionEditor 
          examId={examId}
          userId={userId}
          initialQuestions={questions}
          onQuestionsChange={setQuestions}
        />
      </div>
    </main>
  );
}
