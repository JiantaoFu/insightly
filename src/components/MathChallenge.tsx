import React, { useState } from 'react';

// Type definition for the math challenge
export interface MathChallenge {
  question: string;
  answer: number;
  challenge: string;
}

export interface MathChallengeProps {
  isOpen: boolean;
  onClose: () => void;
  onChallengeComplete: (challenge: MathChallenge) => void;
  onChallengeFail?: () => void;
}

// Function to generate a math challenge (moved from App.tsx)
export function generateMathChallenge(): MathChallenge {
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let num1, num2, answer;
  
  switch (operation) {
    case '+':
      num1 = Math.floor(Math.random() * 20) + 1;
      num2 = Math.floor(Math.random() * 20) + 1;
      answer = num1 + num2;
      break;
    case '-':
      num1 = Math.floor(Math.random() * 30) + 10;
      num2 = Math.floor(Math.random() * 10) + 1;
      answer = num1 - num2;
      break;
    case '*':
      num1 = Math.floor(Math.random() * 10) + 1;
      num2 = Math.floor(Math.random() * 10) + 1;
      answer = num1 * num2;
      break;
    default:
      throw new Error('Invalid operation');
  }

  return {
    question: `What is ${num1} ${operation} ${num2}?`,
    answer: answer,
    challenge: `${num1}${operation}${num2}`
  };
}

export const MathChallengeComponent: React.FC<MathChallengeProps> = ({ 
  isOpen, 
  onClose, 
  onChallengeComplete, 
  onChallengeFail 
}) => {
  const [mathChallenge, setMathChallenge] = useState<MathChallenge | null>(generateMathChallenge());
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [error, setError] = useState<string>('');

  React.useEffect(() => {
    if (isOpen && !mathChallenge) {
      setMathChallenge(generateMathChallenge());
      setUserAnswer('');
      setError('');
    }
  }, [isOpen, mathChallenge]);

  const handleSubmit = () => {
    if (!mathChallenge) return;

    const challengeAnswer = parseInt(userAnswer, 10);
    
    if (challengeAnswer === mathChallenge.answer) {
      onChallengeComplete(mathChallenge);
      onClose();
      setMathChallenge(null);
      setUserAnswer('');
      setError('');
    } else {
      setError('Incorrect answer. Please try again.');
      setMathChallenge(generateMathChallenge());
      setUserAnswer('');
      onChallengeFail?.();
    }
  };

  if (!isOpen || !mathChallenge) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-xl">
      <h2 className="text-xl font-bold mb-4">Human Verification</h2>
      <p className="mb-4">{mathChallenge.question}</p>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <input 
        type="number" 
        inputMode="numeric"
        pattern="[0-9]*"
        value={userAnswer}
        onChange={(e) => setUserAnswer(e.target.value)}
        className="w-full px-3 py-2 border rounded"
        placeholder="Your answer"
        autoFocus
      />
      <button 
        onClick={handleSubmit}
        className="mt-4 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
      >
        Verify
      </button>
    </div>
  </div>
  );
};
