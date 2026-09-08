import { StateCreator } from 'zustand';
import { AnatomicalPart } from '../../shared/types/index.ts';

export type QuizStatus = 'IDLE' | 'LOADING' | 'WAITING_FOR_USER' | 'CORRECT' | 'INCORRECT';

export interface QuizSlice {
  quizTarget: AnatomicalPart | null;
  quizQuestion: string | null;
  quizStatus: QuizStatus;
  setQuizTarget: (target: AnatomicalPart | null) => void;
  setQuizQuestion: (question: string | null) => void;
  setQuizStatus: (status: QuizStatus) => void;
  resetQuizState: () => void;
}

export const createQuizSlice: StateCreator<QuizSlice> = (set) => ({
  quizTarget: null,
  quizQuestion: null,
  quizStatus: 'IDLE',
  setQuizTarget: (quizTarget) => set({ quizTarget }),
  setQuizQuestion: (quizQuestion) => set({ quizQuestion }),
  setQuizStatus: (quizStatus) => set({ quizStatus }),
  resetQuizState: () => set({ quizTarget: null, quizQuestion: null, quizStatus: 'IDLE' }),
});
