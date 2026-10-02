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
Based on the app reviews provided, generate a structured markdown report.

CRITICAL: You MUST use EXACTLY the following 8 section headings, in this order, with these exact titles. Do NOT use any other section titles (e.g. do NOT write "Thematic Analysis", "Competitive Differentiation", or "Actionable Insights" — those are from an old template and are FORBIDDEN):

1. Summary Table (Concise Overview)
2. Cross-App Pain Point Clustering
3. Opportunity Scoring & Ranking
4. Overall Sentiment Analysis
5. Feature-Specific Analysis
6. What This Means for YOU
7. Competitive SWOT Analysis
8. Conclusion

Each section is defined below. Follow them precisely.

---

### 1. **Summary Table (Concise Overview)**
   - Generate a **clear and well-structured table** that summarizes the following for each app:
     - **Overall Sentiment**: Positive, Neutral, Negative
     - **Key Positive Themes** (Top 2-3)
     - **Key Negative Themes** (Top 2-3)

   **Table Formatting Guidelines:**
   - Keep **columns minimal** to ensure readability.
   - Avoid excessive text within table cells—**use concise bullet points**.

---

### 2. **Cross-App Pain Point Clustering**
   Group ALL negative themes from ALL apps into clusters. This is the most important section.
   - **Tier 1 — Market-wide pain points** (appears in 3+ apps): these are category-level gaps no one has solved well. For each, list which apps suffer from it and the approximate % of their 1-2 star reviews mentioning it.
   - **Tier 2 — App-specific pain points** (dominant in only 1-2 apps): these are differentiation opportunities — what one competitor gets uniquely wrong.
   - For each cluster include 1-2 illustrative review quotes.

---

### 3. **Opportunity Scoring & Ranking**
   Score every pain point cluster from Section 2 using this transparent formula:

   **Opportunity Score = Frequency × Severity × Coverage**

   - **Frequency** (1-10): % of negative reviews mentioning this theme, scaled to 1-10 (e.g. 40% → 8)
   - **Severity** (1-10): how angry are users? 9-10 = churn language ("deleted", "switching to", "cancelled"); 6-8 = strong frustration ("unusable", "dealbreaker"); 3-5 = annoyance; 1-2 = minor gripe
   - **Coverage** (1-10): how many compared apps suffer from it, scaled (all apps = 10, single app = 3)

   Present a **ranked table** with columns: Rank | Pain Point | Frequency | Severity | Coverage | Score (max 1000) | Affected Apps
   Show the math for each row so the score is transparent, not magic.
   Then write 2-3 sentences on what the top 3 opportunities mean for someone entering or competing in this market.

---

### 4. **Overall Sentiment Analysis**
   - For each app: overall sentiment (Positive / Neutral / Negative) with 1-2 sentence justification citing review evidence.

---

### 5. **Feature-Specific Analysis**
   - Analyze user reviews based on key features relevant to the app category:
     - **User Interface (UI) & UX**
     - **Performance & Stability**
     - **Functionality & Features**
     - **Pricing & Value**
     - **Customer Support**
     - **[Category-Specific Feature]**

   **For Each Feature, Provide:**
   - **Key Themes** (Recurring feedback, both positive and negative)
   - **Which apps** lead / lag on this feature

---

### 6. **What This Means for YOU**
   If a "Your App" description was provided, generate personalized battle-plan recommendations:
   - **Which competitor weakness to attack first** in marketing (cite the specific pain point %, e.g. "40% of [App X]'s 1-star reviews complain about forced permissions — lead your landing page with 'no full access required'")
   - **Top 3 features/positioning angles** to build or emphasize, drawn from the ranked opportunities in Section 3
   - **Suggested App Store description angles** or headline copy grounded in real competitor complaints
   - **What NOT to copy** from competitors (their most-hated patterns)

   If no "Your App" was provided, write generic market-entry recommendations instead:
   - The single biggest gap in this market and who is most vulnerable
   - 3 concrete positioning angles a new entrant could own, each backed by review evidence

---

### 7. **Competitive SWOT Analysis**
   - Conduct a **SWOT Analysis** for each app **relative to its competitors**:
     - **Strengths**: Features users love.
     - **Weaknesses**: Key areas of dissatisfaction.
     - **Opportunities**: Unmet user needs or gaps in the market.
     - **Threats**: Competitive risks or external challenges.

---

### 8. **Conclusion**
   - Summarize the top 3 market opportunities in one paragraph each.
   - One-sentence verdict: where is this market most vulnerable to a new entrant?
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