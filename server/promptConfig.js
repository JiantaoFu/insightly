export const formatPrompt = `
**Formatting Requirements:**
- Use markdown formatting with appropriate headers and bullet points.
- Do NOT wrap the final output in triple backticks.

For example, the output should start like:

# Summary of Key Insights
- ...

NOT like this:

\`\`\`Markdown
# Summary of Key Insights
- ...
\`\`\`
`;

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

${formatPrompt}
`;

export const appComparisonPrompt = `
**Analysis Instructions:**

1. **Overall Sentiment Analysis:** For each app, determine the overall user sentiment (positive, negative, neutral). Calculate the percentage of reviews falling into each sentiment category.  *Explain your methodology for sentiment classification (e.g., lexicon-based, machine learning-based).*

2. **Feature-Specific Analysis:** Analyze user reviews for each app related to the following key features (add, modify, or prioritize as needed based on your app category):
    * **User Interface (UI) / User Experience (UX):**  Ease of use, navigation, design, aesthetics.
    * **Performance & Stability:** Crashes, bugs, speed, responsiveness.
    * **Functionality & Features:**  Available features, their effectiveness, and user satisfaction.
    * **Pricing & Value:**  Cost, subscription models, in-app purchases, perceived value.
    * **Customer Support:** Responsiveness, helpfulness, communication quality.
    * **[Specific Feature Relevant to Your App Category]:**  (e.g., for a photo editing app: Filters, Editing Tools; for a social media app: Community Features, Privacy Controls).

    *For each feature, identify:*
        * **Key Themes:** Recurring user feedback (positive and negative).
        * **Sentiment Distribution:** How users feel about the feature (e.g., % positive, % negative).
        * **Example Review Snippets:** Illustrative quotes from user reviews.

3. **Thematic Analysis (Beyond Specific Features):** Identify the top 5-10 *additional* recurring themes (both positive and negative) in user reviews for each app that are *not* covered in the Feature-Specific Analysis.  Provide example review snippets for each theme.

4. **Competitive SWOT Analysis:** Conduct a SWOT analysis for each app, focusing on how they compare to the other target apps:
    * **Strengths:** What does the app do well, according to users?  *Relate these to specific features or themes.*
    * **Weaknesses:** Where does the app fall short?  *Relate these to specific features or themes.*
    * **Opportunities:** What unmet user needs or market gaps could the app address? *Base these on user feedback and market trends.*
    * **Threats:** What external factors or competitive pressures could negatively impact the app?  *Consider user churn, competitor actions, and technological changes.*

5. **Competitive Differentiation:**  Clearly articulate the key differentiators (both positive and negative) for each app compared to its competitors.  Where does each app have a competitive edge, and where is it vulnerable?

6. **Actionable Insights & Recommendations:** Based on the analysis, provide specific and actionable recommendations for:
    * **Product Improvements:**  What features should be added, modified, or removed?  Prioritize these recommendations.
    * **Marketing Strategies:** How can the app's strengths be leveraged and weaknesses mitigated in marketing campaigns?
    * **Competitive Positioning:** How can the app differentiate itself more effectively in the market?

**Output Format:**

* **Summary Table:** A concise table summarizing the overall sentiment, key themes, and SWOT for each app.
* **Detailed Reports (One per app):** In-depth reports for each app covering all the analysis points mentioned above, including example review snippets.
* **Comparative Analysis:** A section comparing and contrasting the apps across all dimensions, highlighting key differences and similarities.
* **Actionable Recommendations:** A separate section listing the prioritized recommendations for product improvements, marketing strategies, and competitive positioning.

${formatPrompt}

Perform a comprehensive comparative analysis of the following competitor apps:
`

export const promptConfig = {
  appReviewAnalysis: appReviewAnalysisPrompt,
  format: formatPrompt,
  appComparison: appComparisonPrompt
};

export default promptConfig;