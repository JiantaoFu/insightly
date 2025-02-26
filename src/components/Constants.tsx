export const DEFAULT_APP_ANALYZE_PROMPT = `Analyze the app reviews provided and generate a structured markdown report that includes the following sections:

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

export const DEFAULT_APP_COMPARE_PROMPT = `Based on the app reviews provided, generate a structured markdown report that includes the following sections:

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

// Get math challenge configuration from environment
export const ENABLE_MATH_CHALLENGE = import.meta.env.VITE_ENABLE_MATH_CHALLENGE === 'true';

// Get server URL from environment
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';