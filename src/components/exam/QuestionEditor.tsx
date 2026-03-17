'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

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

interface FormData {
  type: 'mcq' | 'short_answer' | 'long_answer';
  question_text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string; // stores the LABEL (A/B/C/D) for display, we resolve to value on save
  marks: number;
  grading_hint: string;
}

interface QuestionEditorProps {
  examId: string;
  userId: string;
  initialQuestions: Question[];
  onQuestionsChange: (questions: Question[]) => void;
}

const getQuestionTypeLabel = (type: string) => {
  switch (type) {
    case 'mcq': return 'MCQ';
    case 'short_answer': return 'Short Answer';
    case 'long_answer': return 'Long Answer';
    default: return type;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'mcq': return 'bg-blue-100 text-blue-800';
    case 'short_answer': return 'bg-green-100 text-green-800';
    case 'long_answer': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// Normalize options from DB (could be {label,value}[] or string[])
function normalizeOptions(options: any): QuestionOption[] | null {
  if (!options) return null;
  
  // If it's a string, parse it first
  let parsed = options;
  if (typeof options === 'string') {
    try {
      parsed = JSON.parse(options);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;

  return parsed.map((o: any) =>
    typeof o === 'object'
      ? { label: o.label ?? '', value: o.value ?? '' }
      : { label: '', value: String(o) }
  );
}

export default function QuestionEditor({
  examId,
  userId,
  initialQuestions,
  onQuestionsChange,
}: QuestionEditorProps) {
  const supabase = createSupabaseBrowserClient();
  const [questions, setQuestions] = useState<Question[]>(
  initialQuestions.map((q) => ({
    ...q,
    options: normalizeOptions(q.options),
  }))
);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    type: 'mcq',
    question_text: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    marks: 1,
    grading_hint: '',
  });

  // When selecting a question, populate form
  useEffect(() => {
    if (!selectedQuestionId) return;
    const question = questions.find((q) => q.id === selectedQuestionId);
    if (!question) return;

    const normalized = normalizeOptions(question.options);

    if (question.type === 'mcq' && normalized) {
      // Find which label (A/B/C/D) matches the stored correct_answer value
      const correctLabel =
        normalized.find((o) => o.value === question.correct_answer)?.label ??
        question.correct_answer; // fallback to stored value

      setFormData({
        type: question.type,
        question_text: question.question_text,
        optionA: normalized[0]?.value ?? '',
        optionB: normalized[1]?.value ?? '',
        optionC: normalized[2]?.value ?? '',
        optionD: normalized[3]?.value ?? '',
        correctAnswer: correctLabel,
        marks: question.marks,
        grading_hint: question.grading_hint ?? '',
      });
    } else {
      setFormData({
        type: question.type,
        question_text: question.question_text,
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: question.correct_answer,
        marks: question.marks,
        grading_hint: question.grading_hint ?? '',
      });
    }
  }, [selectedQuestionId, questions]);

  const resetForm = () => {
    setFormData({
      type: 'mcq',
      question_text: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      marks: 1,
      grading_hint: '',
    });
    setSelectedQuestionId(null);
  };

  const handleSaveQuestion = async () => {
    if (!formData.question_text.trim()) {
      toast.error('Question text is required');
      return;
    }
    if (formData.type === 'mcq') {
      if (!formData.optionA || !formData.optionB || !formData.optionC || !formData.optionD) {
        toast.error('All MCQ options are required');
        return;
      }
    }

    setIsSaving(true);
    try {
      const options =
        formData.type === 'mcq'
          ? [
              { label: 'A', value: formData.optionA },
              { label: 'B', value: formData.optionB },
              { label: 'C', value: formData.optionC },
              { label: 'D', value: formData.optionD },
            ]
          : null;

      // For MCQ: store the VALUE of the correct option, not the label
      // e.g. if correct is "A" and optionA is "Delhi", store "Delhi"
      let correctAnswerToStore = formData.correctAnswer;
      if (formData.type === 'mcq' && options) {
        const matchedOption = options.find(
          (o) => o.label === formData.correctAnswer
        );
        if (matchedOption) {
          correctAnswerToStore = matchedOption.value;
        }
      }

      if (selectedQuestionId) {
        const selectedQuestion = questions.find((q) => q.id === selectedQuestionId);
        if (!selectedQuestion) { toast.error('Question not found'); return; }

        const { error } = await supabase.rpc('update_question', {
          question_id_param: selectedQuestionId,
          teacher_id_param: userId,
          order_index_param: selectedQuestion.order_index,
          type_param: formData.type,
          question_text_param: formData.question_text,
          options_param: options ? JSON.stringify(options) : null,
          correct_answer_param: correctAnswerToStore,
          marks_param: formData.marks,
          grading_hint_param: formData.grading_hint || null,
        } as any);

        if (error) { toast.error('Failed to update question'); return; }
        toast.success('Question updated successfully');
      } else {
        const nextOrderIndex =
          questions.length > 0
            ? Math.max(...questions.map((q) => q.order_index)) + 1
            : 1;

        const { error } = await supabase.rpc('save_question', {
          exam_id_param: examId,
          teacher_id_param: userId,
          order_index_param: nextOrderIndex,
          type_param: formData.type,
          question_text_param: formData.question_text,
          options_param: options ? JSON.stringify(options) : null,
          correct_answer_param: correctAnswerToStore,
          marks_param: formData.marks,
          grading_hint_param: formData.grading_hint ?? null,
        } as any);

        if (error) { toast.error('Failed to add question'); return; }
        toast.success('Question added successfully');
      }

      resetForm();

      // Refresh questions list
      const { data: updatedQuestions, error: refreshError } = await supabase
        .rpc('get_exam_questions', { exam_id_param: examId } as any);

      if (!refreshError && updatedQuestions) {
        const normalized = updatedQuestions.map((q: any) => ({
          ...q,
          options: normalizeOptions(q.options),
        }));
        setQuestions(normalized);
        onQuestionsChange(normalized);
      }
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const { error } = await supabase.rpc('delete_question', {
        question_id_param: questionId,
        teacher_id_param: userId,
      } as any);

      if (error) { toast.error('Failed to delete question'); return; }

      const updatedQuestions = questions.filter((q) => q.id !== questionId);
      setQuestions(updatedQuestions);
      onQuestionsChange(updatedQuestions);
      if (selectedQuestionId === questionId) resetForm();
      toast.success('Question deleted successfully');
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('An unexpected error occurred');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Questions List */}
      <div className="lg:col-span-1">
        <Card className="p-6 border border-gray-200 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Questions</h2>
            <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
              {questions.length}
            </span>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No questions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => setSelectedQuestionId(question.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedQuestionId === question.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium text-gray-900">Q {index + 1}</span>
                    <Badge className={getTypeColor(question.type)}>
                      {getQuestionTypeLabel(question.type)}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {question.question_text}
                  </p>
                  <div className="mt-2">
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      {question.marks} marks
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Question Editor Form */}
      <div className="lg:col-span-2">
        <Card className="p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">
              {selectedQuestionId ? 'Edit Question' : 'Add New Question'}
            </h2>
            {selectedQuestionId && (
              <button
                onClick={() => {
                  handleDeleteQuestion(selectedQuestionId);
                  resetForm();
                }}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>

          <div className="space-y-6">
            {/* Question Type */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Question Type
              </Label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as 'mcq' | 'short_answer' | 'long_answer',
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="mcq">Multiple Choice (MCQ)</option>
                <option value="short_answer">Short Answer</option>
                <option value="long_answer">Long Answer</option>
              </select>
            </div>

            {/* Question Text */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Question Text
              </Label>
              <Textarea
                value={formData.question_text}
                onChange={(e) =>
                  setFormData({ ...formData, question_text: e.target.value })
                }
                placeholder="Enter the question here..."
                rows={4}
              />
            </div>

            {/* MCQ Options */}
            {formData.type === 'mcq' && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Options</h3>
                {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map(
                  (optionKey, idx) => (
                    <div key={optionKey}>
                      <Label className="block text-sm text-gray-700 mb-1">
                        Option {String.fromCharCode(65 + idx)}
                      </Label>
                      <Input
                        value={formData[optionKey]}
                        onChange={(e) =>
                          setFormData({ ...formData, [optionKey]: e.target.value })
                        }
                        placeholder={`Enter option ${String.fromCharCode(65 + idx)}`}
                      />
                    </div>
                  )
                )}

                {/* Correct Answer — shows label but saves value */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Correct Answer
                  </Label>
                  <select
                    value={formData.correctAnswer}
                    onChange={(e) =>
                      setFormData({ ...formData, correctAnswer: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="A">
                      Option A {formData.optionA ? `— ${formData.optionA}` : ''}
                    </option>
                    <option value="B">
                      Option B {formData.optionB ? `— ${formData.optionB}` : ''}
                    </option>
                    <option value="C">
                      Option C {formData.optionC ? `— ${formData.optionC}` : ''}
                    </option>
                    <option value="D">
                      Option D {formData.optionD ? `— ${formData.optionD}` : ''}
                    </option>
                  </select>
                </div>
              </div>
            )}

            {/* Short/Long Answer correct answer */}
            {formData.type !== 'mcq' && (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.type === 'short_answer'
                    ? 'Model Answer'
                    : 'Sample Answer / Grading Rubric'}
                </Label>
                <Textarea
                  value={formData.correctAnswer}
                  onChange={(e) =>
                    setFormData({ ...formData, correctAnswer: e.target.value })
                  }
                  placeholder="Enter the expected answer or rubric..."
                  rows={4}
                />
              </div>
            )}

            {/* Marks */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Marks
              </Label>
              <Input
                type="number"
                min="1"
                value={formData.marks}
                onChange={(e) =>
                  setFormData({ ...formData, marks: parseInt(e.target.value) || 1 })
                }
              />
            </div>

            {/* Grading Hint */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Grading Hint (Optional)
              </Label>
              <Textarea
                value={formData.grading_hint}
                onChange={(e) =>
                  setFormData({ ...formData, grading_hint: e.target.value })
                }
                placeholder="Special instructions for grading this question..."
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                onClick={handleSaveQuestion}
                disabled={isSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSaving
                  ? 'Saving...'
                  : selectedQuestionId
                  ? 'Update Question'
                  : 'Add Question'}
              </Button>
              {selectedQuestionId && (
                <Button
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel Edit
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}