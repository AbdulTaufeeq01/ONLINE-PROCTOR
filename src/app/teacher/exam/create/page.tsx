'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import TeacherNavbar from '@/components/layout/TeacherNavbar';

// Validation schema
const createExamSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .min(1, 'Title is required'),
  description: z.string().optional(),
  duration_minutes: z
    .number()
    .min(5, 'Duration must be at least 5 minutes')
    .max(300, 'Duration cannot exceed 300 minutes'),
  pass_marks: z.number().min(0, 'Pass marks cannot be negative').optional(),
  shuffle_questions: z.boolean(),
  webcam_required: z.boolean(),
  fullscreen_required: z.boolean(),
  allow_spelling_mistakes: z.boolean(),
});

type CreateExamFormData = z.infer<typeof createExamSchema>;

export default function CreateExamPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CreateExamFormData>({
    resolver: zodResolver(createExamSchema),
    defaultValues: {
      duration_minutes: 60,
      pass_marks: 0,
      shuffle_questions: true,
      webcam_required: true,
      fullscreen_required: true,
      allow_spelling_mistakes: true,
    },
    mode: 'onBlur',
  });

  // Watch toggle values
  const shuffleQuestions = watch('shuffle_questions');
  const webcamRequired = watch('webcam_required');
  const fullscreenRequired = watch('fullscreen_required');
  const allowSpellingMistakes = watch('allow_spelling_mistakes');

  const onSubmit = async (data: CreateExamFormData) => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('Failed to get user information');
        setIsLoading(false);
        return;
      }

      // Insert exam into database
      const { data: newExam, error: insertError } = await supabase
        .from('exams')
        .insert({
          title: data.title,
          description: data.description || null,
          duration_minutes: data.duration_minutes,
          pass_marks: data.pass_marks || 0,
          shuffle_questions: data.shuffle_questions,
          webcam_required: data.webcam_required,
          fullscreen_required: data.fullscreen_required,
          allow_spelling_mistakes: data.allow_spelling_mistakes,
          teacher_id: user.id,
          status: 'draft',
        })
        .select()
        .single();

      if (insertError) {
        toast.error(insertError.message || 'Failed to create exam');
        setIsLoading(false);
        return;
      }

      if (!newExam) {
        toast.error('Failed to create exam');
        setIsLoading(false);
        return;
      }

      toast.success('Exam created successfully!');
      router.push(`/teacher/exam/${newExam.id}/edit`);
    } catch (error) {
      console.error('Create exam error:', error);
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <TeacherNavbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Link */}
        <Link href="/teacher/home" className="text-indigo-600 hover:text-indigo-700 font-medium mb-6 inline-block">
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Create New Exam
          </h1>
          <p className="text-gray-600">
            Set up your exam details and configure proctoring settings
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-8 shadow-md border border-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Exam Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-700 font-medium">
                Exam Title *
              </Label>
              <Input
                id="title"
                type="text"
                placeholder="Advanced Mathematics Final Exam"
                {...register('title')}
                disabled={isLoading}
                className="h-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
              {errors.title && (
                <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-700 font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Enter exam description (optional)"
                {...register('description')}
                disabled={isLoading}
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 min-h-24"
              />
              {errors.description && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Duration and Pass Marks */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="duration_minutes" className="text-gray-700 font-medium">
                  Duration (minutes) *
                </Label>
                <Input
                  id="duration_minutes"
                  type="number"
                  min={5}
                  max={300}
                  {...register('duration_minutes', { valueAsNumber: true })}
                  disabled={isLoading}
                  className="h-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                />
                {errors.duration_minutes && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.duration_minutes.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass_marks" className="text-gray-700 font-medium">
                  Pass Marks
                </Label>
                <Input
                  id="pass_marks"
                  type="number"
                  min={0}
                  {...register('pass_marks', { valueAsNumber: true })}
                  disabled={isLoading}
                  className="h-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                />
                {errors.pass_marks && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.pass_marks.message}
                  </p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Proctoring Settings
              </h3>

              {/* Toggle Settings */}
              <div className="space-y-4">
                {/* Shuffle Questions Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-gray-700 font-medium block">
                      Shuffle Questions
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Randomize question order for each student
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('shuffle_questions')}
                      disabled={isLoading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>

                {/* Webcam Required Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-gray-700 font-medium block">
                      Require Webcam
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Students must enable webcam during exam
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('webcam_required')}
                      disabled={isLoading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>

                {/* Fullscreen Required Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-gray-700 font-medium block">
                      Require Fullscreen
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Students must be in fullscreen mode
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('fullscreen_required')}
                      disabled={isLoading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>

                {/* Allow Spelling Mistakes Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-gray-700 font-medium block">
                      Allow Spelling Mistakes
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Don't penalize minor spelling variations in answers
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('allow_spelling_mistakes')}
                      disabled={isLoading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-gray-200">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md transition-colors duration-200"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating Exam...</span>
                  </div>
                ) : (
                  'Create Exam'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
