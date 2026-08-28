---
schema_version: 1
page_id: homepage
url_patterns:
  - https://law-tracker.europa.eu/homepage
  - https://law-tracker.europa.eu/homepage?lang=en
purpose: entry point; hosts quick search, Browse by topic and the Advanced Search panel
last_verified: 2026-08-28
source: local
---

# Homepage

All three search modes live here and all produce a deep-linkable `/results?...` URL. **If you already know what you are looking for, do not come through this page**: build the results URL directly (see `pages/results.md`) or use `opencli law-tracker search`.

## Visual anchors

- text: `EU Law Tracker` as `heading level=1` (present on every page, not enough on its own)
- a11y: `textbox "Quick search"` plus `button "Search"` — this pair identifies the homepage
- a11y: `button "Browse by topics"` and `button "Advanced Search"` (`expanded=false` when closed)

## Actions on this page

### action:dismiss_cookie_banner
pre: first visit for this browser profile; `region "Cookies policy"` is present
do: click the `Accept only essential cookies` link inside the region
post: the "Cookies policy" region disappears from the snapshot; clicks on page buttons are no longer intercepted
fail: `Element is covered by <a ... inside div#cookie-consent-banner>` on any click
recover: run this action before anything else; or skip the page entirely and navigate to a `/results?...` URL
evidence: agent-browser click @e30 → error "covered by ... #cookie-consent-banner"; agent-browser click @e6 (Accept only essential cookies) → banner gone

### action:quick_search
pre: homepage loaded, cookie banner already dismissed
do: fill `textbox "Quick search"` with the text, then click `button "Search"`
post: URL becomes `/results?quickSearch=<q>&sort=REL&page=0&pageSize=10&lang=en`, page title `Search results`
fail: the click has no effect and the URL stays on `/homepage` | "covered by" error
recover: run `action:dismiss_cookie_banner`, then retry; or navigate straight to the results URL
evidence: agent-browser fill @e27 "climate" + click @e26 → https://law-tracker.europa.eu/results?quickSearch=climate&sort=REL&page=0&pageSize=10&lang=en

### action:browse_by_topic
pre: homepage loaded, banner dismissed
do: click `button "Browse by topics"`, check the box of the domain you want (21 EuroVoc tiles), click `button "Continue"`
post: URL `/results?eurovoc=["<code>,DOM"]&searchType=topics&sort=DOCD_DESC&page=0&pageSize=10&lang=en`, title `Search results`
fail: `button "Continue"` stays `disabled` (no topic selected)
recover: check at least one box before pressing Continue
evidence: agent-browser click @e17 → check @e57 (Environment) → find role button click --name "Continue" → results?eurovoc=%5B%2252,DOM%22%5D&searchType=topics

### action:advanced_search
pre: homepage loaded, banner dismissed
do: click `button "Advanced Search"` (accordion, the URL does not change), set the fields you need, click the `button "Search"` at the bottom of the panel
post: URL `/results?searchType=advanced&<filters>&sort=REL&page=0&pageSize=10&lang=en`
fail: the accordion does not open (`expanded` stays false) | the click lands on the quick-search `button "Search"` instead of the panel's own
recover: take the ref of the Search button **inside the panel** from a snapshot taken after it opens, not the quick-search one
evidence: agent-browser find role button click --name "Advanced Search" → click @e54 (Ongoing) + @e64 (First reading) + @e44 → results?searchType=advanced&statusType=ONG&stage=%5B%22FR%22%5D

## Advanced Search fields

Proposal title (Title) · Procedure reference (Year, Number, Type) · Status (All / Ongoing / Adopted / Not adopted / Withdrawn, plus date filters) · Stage (Proposal, First reading, Second reading, Conciliation and third reading, End of procedure) · Events (EU institution/body, Event, date).

The codes that end up in the URL and in the API body are listed by `opencli law-tracker topics <kind>`.

## Linked APIs

`advanced_search_dropdown_nodes` populates the panel menus and the Browse by topic tiles. `search` is the POST fired when Search is pressed. See `endpoints.json`.
