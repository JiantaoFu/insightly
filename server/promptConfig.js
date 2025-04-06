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
Based on the app reviews provided, generate a structured markdown report that includes the following sections:

---

### 1. **Summary Table (Concise Overview)**
   - Generate a **clear and well-structured table** that summarizes the following for each app:
     - **Overall Sentiment**: Positive, Neutral, Negative
     - **Key Positive Themes** (Top 2-3)
     - **Key Negative Themes** (Top 2-3)
     - **SWOT Summary** (Brief points for Strengths, Weaknesses, Opportunities, and Threats)

   **Table Formatting Guidelines:**
   - Keep **columns minimal** to ensure readability.
   - Avoid excessive text within table cells—**use concise bullet points**.
   - If needed, split details across multiple rows rather than cramming too many columns in one row.

---

### 2. **Overall Sentiment Analysis**
   - Determine **overall sentiment** for each app: Positive, Neutral, or Negative.
   - Provide a **percentage breakdown** of sentiment categories.
   - Explain your **methodology** for sentiment classification (e.g., lexicon-based, ML-based).

---

### 3. **Feature-Specific Analysis**
   - Analyze user reviews based on key features relevant to the app category:
     - **User Interface (UI) & UX**
     - **Performance & Stability**
     - **Functionality & Features**
     - **Pricing & Value**
     - **Customer Support**
     - **[Category-Specific Feature]** (e.g., Filters for a photo app)

   **For Each Feature, Provide:**
   - **Key Themes** (Recurring feedback, both positive and negative)
   - **Sentiment Distribution** (% positive, % negative)
   - **Example Review Snippets** (Illustrative quotes from user reviews)

---

### 4. **Thematic Analysis (Beyond Features)**
   - Identify **5-10 additional themes** not covered under feature analysis.
   - Provide **brief summaries** of each theme with **example review snippets**.

---

### 5. **Competitive SWOT Analysis**
   - Conduct a **SWOT Analysis** for each app **relative to its competitors**:
     - **Strengths**: Features users love.
     - **Weaknesses**: Key areas of dissatisfaction.
     - **Opportunities**: Unmet user needs or gaps in the market.
     - **Threats**: Competitive risks or external challenges.

   **Table Formatting Guidelines:**
   - Use a **two-column format** to maintain clarity:
     - Column 1: **SWOT Category**
     - Column 2: **Summary (Concise Bullet Points)**

---

### 6. **Competitive Differentiation**
   - Highlight **key differentiators** for each app:
     - What gives it a competitive edge?
     - Where is it vulnerable compared to competitors?

---

### 7. **Actionable Insights & Recommendations**
   - **Product Improvements**: Features to add, modify, or remove (**prioritized**).
   - **Marketing Strategies**: Ways to leverage strengths and mitigate weaknesses.
   - **Competitive Positioning**: Recommendations for better market differentiation.

---

### 8. **Conclusion**
   - Summarize key findings.
   - Provide high-level recommendations for **product strategy**.
`

export const promptConfig = {
  appReviewAnalysis: appReviewAnalysisPrompt,
  format: formatPrompt,
  appComparison: appComparisonPrompt,
  chatPrompts: {
    competitive: {
      id: 'competitive',
      label: 'Competitive Analysis',
      description: 'Analyze competitive research and market gaps, focusing on differentiation, features, pricing, and positioning.',
      template: `Analyze these insights about competitive research and market gaps. For each insight:
1. State the finding
2. Support it with specific quotes and examples from the source data
3. Cite the specific apps where this evidence comes from

Context:
{context}

Question: {query}

Format your response like this:
Key Finding 1:
- Finding: [state the insight]
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Key Finding 2:
[etc...]

Focus on competitive differentiation, feature gaps, pricing models, and market positioning.
Only include findings that you can support with direct evidence from the context.`
    },
    sentiment: {
      id: 'sentiment',
      label: 'User Sentiment',
      description: 'Analyze user sentiment and feedback, focusing on needs, complaints, feature requests, and pain points.',
      template: `Analyze the available data about user sentiment and feedback. For each insight:
1. State the key finding
2. Support with specific examples
3. Focus on:
   - Common user needs and pain points
   - Feature requests and suggestions
   - Satisfaction drivers and detractors
   - User experience patterns

Context:
{context}

Question: {query}

Format your response like this:
Key Finding 1:
- Finding: [state the insight]
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Key Finding 2:
[etc...]

Only include findings that you can support with direct evidence from the context.`
    },
    trends: {
      id: 'trends',
      label: 'Market Trends',
      description: 'Identify emerging patterns, user expectation shifts, and industry trends from the available data.',
      template: `Analyze the market trends and patterns in the available data. For each trend:
1. Identify the trend
2. Provide supporting evidence
3. Focus on:
   - Emerging user behaviors
   - Technology adoption patterns
   - Industry direction indicators
   - Market evolution signs

Context:
{context}

Question: {query}

Format your response like this:
Trend 1:
- Trend: [state the trend]
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Trend 2:
[etc...]

Only include trends that you can support with direct evidence from the context.`
    },
    business: {
      id: 'business',
      label: 'Business Opportunities',
      description: 'Discover product opportunities, business models, and revenue strategies.',
      template: `Analyze business opportunities in the available data. For each opportunity:
1. Describe the opportunity
2. Support with market evidence
3. Focus on:
   - Revenue potential areas
   - Business model innovations
   - Market gaps
   - Growth strategies

Context:
{context}

Question: {query}

Format your response like this:
Opportunity 1:
- Opportunity: [describe the opportunity]
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Opportunity 2:
[etc...]

Only include opportunities that you can support with direct evidence from the context.`
    },
    pmf: {
      id: 'pmf',
      label: 'Product Market Fit',
      description: 'Evaluate product-market fit with analysis of target markets, user problems, and business model insights.',
      template: `Analyze product-market fit indicators in the available data. Cover:
1. Target Market Evidence:
   - User demographics and segments
   - Market size indicators
2. Problem-Solution Fit:
   - Key user problems
   - Solution effectiveness
3. Business Model Validation:
   - Willingness to pay
   - Customer acquisition
4. Recommendations:
   - Areas for improvement
   - Expansion opportunities

Context:
{context}

Question: {query}

Format your response like this:
Target Market Evidence:
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Problem-Solution Fit:
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Business Model Validation:
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Recommendations:
- [state the recommendation]

Only include findings that you can support with direct evidence from the context.`
    }
  }
};

export default promptConfig;