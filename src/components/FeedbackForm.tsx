import React from 'react';
import { useForm, ValidationError } from '@formspree/react';
import { X } from 'lucide-react';

interface FeedbackFormProps {
  onClose: () => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ onClose }) => {
  const [state, handleSubmit] = useForm("xldbegdo");

  if (state.succeeded) {
    return (
      <div className="bg-white rounded-lg p-6 text-center shadow-xl">
        <p className="text-green-600 font-medium mb-4">Thank you for your feedback!</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 right-0 z-10 flex justify-between items-center bg-white mb-4">
        <h2 className="text-xl font-bold">Share Your Feedback</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <ValidationError prefix="Email" field="email" errors={state.errors} className="text-sm text-red-600" />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
              Your Feedback
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <ValidationError prefix="Message" field="message" errors={state.errors} className="text-sm text-red-600" />
          </div>
        </div>

        <button
          type="submit"
          disabled={state.submitting}
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.submitting ? 'Sending...' : 'Send Feedback'}
        </button>
      </form>
    </div>
  );
};

export default FeedbackForm;
