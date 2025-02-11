export const appReviewAnalysisPrompt = `
Analyze the app reviews provided and generate a structured markdown report that includes the following sections:

1. **Summary of Key Insights**
   - Provide an overall overview of the main findings.
   - Summarize key strengths and weaknesses.
   - Include overall sentiment and quantitative metrics (e.g., overall rating, breakdown percentages for each star rating such as percentage of 5-star, 4-star, etc., and score distribution if available).

2. **Data & Methodology Overview**
   - Briefly describe the data sample size, the time frame of the reviews, and the analysis methods (e.g., sentiment analysis, keyword extraction).

3. **Key User Pain Points**
   - List the most frequently mentioned issues and explain their impact on the user experience.

4. **Frequently Requested Features**
   - Highlight the features that users request most often.

5. **Strengths and Positive Aspects**
   - Summarize what users like about the app, such as ease of use, design, or unique features.

6. **Prioritized Action Recommendations**
   - Provide prioritized suggestions for improvements based on the frequency and severity of issues.
   - Optionally, categorize issues by priority (e.g., high, medium, low).

7. **Opportunities for Startup Ideas**
   - Identify innovative ideas or opportunities for new products or enhancements derived from user feedback.

8. **Trends and Observations**
   - Summarize recurring patterns or changes over time, including language preferences or shifts in sentiment.
   - Note any significant trends that could impact product strategy.

9. **Conclusion**
   - Recap the key insights and implications for product strategy.
   - Offer a brief overall recommendation based on the analysis.

10. **Original App Link**
    - Include the original app URL for reference.
`;

export const promptConfig = {
  appReviewAnalysis: appReviewAnalysisPrompt
};

export default promptConfig;