---
name: insightly-app-reviews
description: Use when the user asks what people like or complain about in a mobile app, wants a summary of App Store / Google Play reviews, wants to compare competing apps, or is researching what features to build. Returns a finished analysis (top complaints, praise, feature requests, sentiment) from real reviews, with a shareable report link.
---
# Insightly – app review & competitor analysis
When to use: "What do users hate about <app>?", "Summarize reviews of <app>", "Compare <app A> vs <app B>", "What are the gaps in my competitors' apps?"
Steps:
1. If the user gave a name, not a URL, call `find_app` and confirm the right app.
2. Call `analyze_app_reviews` (or `compare_competitors` for 2–4 apps).
3. Present the summary, cite the review count, and always include `report_url`.
4. If `found: false`, say no cached report exists yet and give the `analyze_url`.
Don't: invent review quotes; use for non-app products.
