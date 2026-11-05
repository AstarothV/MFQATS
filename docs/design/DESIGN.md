---
name: MFQATS
description: Lavender glass for a furniture workshop's quality inspection and order tracking.
colors:
  workshop-violet: "#7C3AED"
  lavender-glow: "#A78BFA"
  lavender-room: "#F3F0F8"
  ink-plum: "#1C1726"
  card-white: "#FFFFFF"
  mist-lilac: "#EEE9F5"
  pale-lilac: "#ECE7F4"
  dusk-gray: "#6B6478"
  lilac-line: "#E2DBEC"
  night-room: "#110E17"
  night-card: "#1B1724"
  night-mist: "#262031"
  night-line: "#2E2839"
  moon-text: "#F2EEF8"
  inspection-stage: "#0B0B0F"
  pass-green: "#22C55E"
  check-amber: "#F59E0B"
  fail-red: "#EF4444"
  info-blue: "#3B82F6"
typography:
  display:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.14em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  2xl: "22px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.workshop-violet}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.mist-lilac}"
    textColor: "{colors.ink-plum}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-ghost:
    textColor: "{colors.dusk-gray}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-plum}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-plum}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  badge:
    rounded: "{rounded.full}"
    padding: "2px 8px"
    typography: "{typography.label}"
  nav-item:
    textColor: "{colors.dusk-gray}"
    rounded: "{rounded.xl}"
    height: "40px"
    padding: "0 12px"
  nav-item-active:
    textColor: "{colors.workshop-violet}"
    rounded: "{rounded.xl}"
    height: "40px"
    padding: "0 12px"
  inspection-viewer:
    backgroundColor: "{colors.inspection-stage}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.xl}"
    height: "460px"
---

# Design System: MFQATS

## Overview

**Creative North Star: "The Lavender Inspection Bench"**

A calm lavender room with clear glass panels laid on it, like a clean bench where every piece of furniture is looked at closely before it leaves. The room is soft (a pale lavender ground with three blurred colour washes behind everything), the panels are glass with a bright top edge, and the one strong colour is Workshop Violet, used for what you can act on. The work itself (photos, 3D models, defect boxes, numbers) sits on top and stays the clearest thing on the screen.

The system means to be calm and clear, polished, and friendly at once: calm enough that a supervisor can read production status at a glance, polished enough to feel like a finished product, and friendly enough for workshop staff with basic digital literacy on a phone. When those pull against each other, the screen decides: on admin and staff screens calm and clear wins, and the data, photos and defects are never covered by decoration; on the customer pages and the landing page, polished and friendly can lead, as long as the content stays clear.

Every screen exists in a light theme and a full dark theme with the same structure; only the room, cards and lines change, and the violet stays the same.

**Key Characteristics:**
- Pale lavender room, glass cards, one violet voice.
- DM Sans everywhere, bold titles with slightly tight tracking, small uppercase labels with wide tracking.
- Generous, soft corners (10–22px); pills for badges.
- Real blur only on floating layers; page cards look like glass without blurring.
- Photos and 3D models sit on a near-black inspection stage, in both themes.
- Green, amber and red only ever mean pass, needs checking, fail.

## Colors

One violet brand colour on a lavender-tinted neutral family, with four status colours that carry meaning only.

### Primary
- **Workshop Violet** (#7C3AED): the working colour. Primary buttons (as a soft top-lit gradient into the solid violet), the active sidebar item, links, focus rings, current-step markers, progress bars, selection highlight and form accents. It marks what you can act on or where you are.

### Secondary
- **Lavender Glow** (#A78BFA): the soft light around the violet. Hover and secondary highlights, the dark-theme active nav text, gradient partners on progress bars, the inspection panel's scanning light, and the gentle shimmer on the landing headline.

### Neutral
- **Lavender Room** (#F3F0F8): the page ground in the light theme, under three blurred washes (violet, pink and sky).
- **Ink Plum** (#1C1726): body text and titles in the light theme; a violet-tinted near-black rather than gray.
- **Card White** (#FFFFFF): the base of cards, inputs and dialogs; on page cards it is shown as translucent glass (80% to 56% white), on dialogs it stays solid.
- **Mist Lilac** (#EEE9F5) and **Pale Lilac** (#ECE7F4): muted fills for secondary buttons, chips, step circles and hover states.
- **Dusk Gray** (#6B6478): secondary text, captions, inactive nav, placeholders.
- **Lilac Line** (#E2DBEC): borders and dividers in the light theme.
- **Night Room** (#110E17), **Night Card** (#1B1724), **Night Mist** (#262031), **Night Line** (#2E2839) and **Moon Text** (#F2EEF8): the same roles in the dark theme.
- **Inspection Stage** (#0B0B0F): the backdrop of every 3D viewer and photo canvas, in both themes.

### Status
- **Pass Green** (#22C55E): passed, done, available, saved.
- **Check Amber** (#F59E0B): needs checking, longer than expected, waiting for review, low stock.
- **Fail Red** (#EF4444): failed, defect that fails the piece, delete, sign out.
- **Info Blue** (#3B82F6): rare; neutral information only.

### Named Rules
**The One Violet Rule.** Workshop Violet is the only brand hue. Lavender Glow supports it; no other hue is decorative. New screens do not introduce teal, orange or a second brand colour.

**The Status Means Status Rule.** Green, amber and red appear only to say pass, needs checking or fail. Never use them as decoration or to colour a category.

**The Tinted Neutral Rule.** Neutrals carry a little violet (Ink Plum, Dusk Gray, Lilac Line). Never use a pure gray or pure black for text or lines.

## Typography

**Display Font:** DM Sans (with sans-serif)
**Body Font:** DM Sans (with sans-serif)

**Character:** one geometric, friendly sans for everything. Hierarchy comes from weight and size, not from a second family: bold for titles, semibold for labels and buttons, regular for reading text. Tables use tabular numerals.

### Hierarchy
- **Display** (700, 2.25rem rising to 4.5rem, 1.25): the landing page headline only.
- **Headline** (700, 26px on phones, 28px from small screens up, 1.25, -0.02em, balanced wrapping): the page title on every app screen.
- **Title** (600, 1rem to 1.125rem, 1.5): card and section titles, dialog titles, product names.
- **Body** (400, 0.875rem, 1.5): most text in cards, lists and forms; 1rem to 1.25rem for landing paragraphs.
- **Label** (600, 0.75rem, 0.14em, uppercase): the page eyebrow above each title, section labels and small stat captions. Badges use the same size at medium weight, without uppercase.

### Named Rules
**The One Family Rule.** DM Sans only. Emphasis comes from weight (400, 500, 600, 700), never from a new typeface.

**The Eyebrow Rule.** Every app page opens with the same three lines: a small uppercase eyebrow naming the area, the bold page title, a one-line muted subtitle (the shared page-eyebrow and page-title styles). That is the only place an eyebrow appears: section and card headings inside a page, dialogs and the landing page carry no label above them; the heading speaks for itself.

## Layout

App screens use a fixed glass sidebar (about 240px, collapsible) and a floating glass top bar, with the page content in a single column of cards. Content stacks vertically with 16px to 24px between cards; inside cards the padding is 16px to 20px. Dashboards use 2- to 4-column grids of cards on wide screens (Tailwind `sm` 640px, `lg` 1024px, `xl` 1280px) that collapse to one column on phones; tables scroll inside their card instead of widening the page.

Process steppers stay in a row on wide screens and stack vertically (icon, then name and time) below `xl`, so every stage stays readable on a phone. The landing page uses a centered container up to 1280px with 80px vertical section spacing.

**The No Sideways Scroll Rule.** No screen scrolls sideways at 390px wide. Wide content scrolls inside its own card, and anything that slides in from the side is clipped by its section.

## Elevation & Depth

Depth comes from glass, not from heavy shadows. Page cards are simulated glass: a translucent white gradient, a 1px faint line, a bright inner top edge and one soft, violet-tinted drop shadow. Floating layers (top bar, sidebar, menus, the profile panel) are the only surfaces with real backdrop blur (24px, saturated). Dialogs are solid so nothing shows through them. Hover lifts a card 2px to 6px with a slightly stronger violet glow.

### Shadow Vocabulary
- **Glass card** (`box-shadow: inset 0 1px 0 var(--glass-edge), 0 1px 2px rgba(28,23,38,0.05), 0 12px 32px -14px rgba(76,29,149,0.22)`): every page card in the light theme; darker and neutral in the dark theme.
- **Floating menu** (`box-shadow: inset 0 1px 0 var(--glass-edge), 0 24px 48px -16px rgba(0,0,0,0.45)`): dropdowns and popovers.
- **Primary button** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.32), 0 8px 20px -10px #7C3AED`): the violet button's top highlight and soft violet pool beneath it.
- **Timer glow** (`box-shadow: 0 0 20px rgba(124,58,237,0.4), 0 0 40px rgba(124,58,237,0.15)`): the Workshop stage timer card only.

### Named Rules
**The Glass-Not-Blur Rule.** Page cards never use backdrop blur; only floating layers do. This keeps scrolling smooth on workshop phones.

**The Solid Dialog Rule.** A card that is itself a dialog is solid Card White (or Night Card), never translucent.

## Shapes

Soft, generous corners throughout, from a 10px base: 8px for small controls, 14px for buttons and inputs, 18px for nav items, menus and viewers, 22px for page cards, and full pills for badges, status tags and stage chips. Circles mark stages and stage results (32px to 44px). Lines are hairline (1px) and faint; nothing uses thick borders except the dashed outline of an empty photo slot.

## Components

### Buttons
Friendly and tactile: they press in slightly (scale 0.96) and never jump the layout.
- **Shape:** gently rounded (14px).
- **Primary:** Workshop Violet as a soft vertical gradient (top 84% violet mixed with white into solid violet), white semibold text, 10px 16px padding, a bright inner top edge and a violet glow beneath. Hover brightens it slightly and deepens the glow.
- **Secondary:** a translucent Mist Lilac fill with a faint line and a bright top edge, Ink Plum semibold text; hover fills it solid.
- **Ghost:** no fill, Dusk Gray text; hover fills Mist Lilac and turns the text Ink Plum.
- **Disabled:** 50% opacity, no press.
- **Focus:** a 2px violet outline offset 2px.

### Badges (status chips)
- **Style:** full pill, 12px medium text, 2px 8px, a 12% tint of the status colour as the fill, the status colour as text and a 25% tint as the line; an optional 6px dot.
- **States:** OK (Pass Green), warning (Check Amber), danger (Fail Red), info (violet), neutral (gray). Stage names use the same pill.

### Cards / Containers
- **Corner Style:** 22px.
- **Background:** glass (Card White 80% to 56% top to bottom; 7.5% to 3% white in the dark theme).
- **Shadow Strategy:** the Glass card shadow (see Elevation & Depth).
- **Border:** 1px faint line.
- **Internal Padding:** 20px (16px for compact cards).

### Inputs / Fields
- **Style:** solid Card White (Night input in the dark theme), 1px Lilac Line, 14px corners, 10px 12px padding, 14px text, Dusk Gray placeholder.
- **Focus:** the border turns Workshop Violet with a soft 4px violet halo (18%).
- **Disabled:** reduced opacity.

### Navigation
- **Sidebar:** a floating glass panel with grouped items under small uppercase labels. Items are 40px tall with 18px corners, icon plus label in Dusk Gray; hover fills Mist Lilac; the active item is a 15% violet fill with semibold violet text (Lavender Glow in the dark theme) and a bright top edge. Sign out sits at the bottom in Fail Red. On phones the sidebar becomes a drawer.
- **Top bar:** a floating glass bar with the logo, the role pill, notifications, the theme switch and the profile menu.

### Process Stepper (signature)
The order's five inspection stages (Upload, 3D Reconstruction, Detect Defects, Results, Recommendation), plus Pending, Confirmed and Delivered on the customer side. Each stage is a circle (32px to 36px) with its name below and, where known, the time spent and when it finished. Done stages are a soft green circle with a green check; the current stage is solid violet; a failed Detect Defects is a solid red circle with a white X; future stages are Mist Lilac. Short connecting lines turn green between finished stages.

### Inspection Viewer (signature)
The 3D model and photo canvases sit on the near-black Inspection Stage (18px corners, about 460px tall, full screen on demand), with a dark pill toggle (Edit mode, Defect pins, Dimensions) at the top left and a round full-screen button at the top right. In edit mode the model is drawn as an even square grid with defect areas painted red, amber or green; a compact dark legend lists each defect and its side.

## Do's and Don'ts

### Do:
- **Do** build every page card with the glass card treatment (translucent gradient, faint line, bright top edge, soft violet shadow) and 22px corners.
- **Do** put 3D models, photos with defect boxes and camera views on the Inspection Stage (#0B0B0F) in both themes.
- **Do** use Workshop Violet for the one primary action on a screen and for "you are here".
- **Do** give every animation a reduced-motion fallback that shows the end state immediately.
- **Do** tint with the theme colours and an opacity (for example `bg-primary/10`, `bg-danger/10`, `bg-muted/50`); they are opacity-capable through color-mix in `tailwind.config.js`, so tints follow the light and dark theme.
- **Do** check every screen at 390px wide: no sideways scrolling, nothing hidden behind the top bar.

### Don't:
- **Don't** add backdrop blur to page cards; blur is only for the top bar, sidebar and menus.
- **Don't** introduce a second brand hue or a second typeface.
- **Don't** use green, amber or red for anything but pass, needs checking or fail.
- **Don't** use gradient text anywhere except the landing page's "Built to Perfection" line.
- **Don't** use pure gray or pure black for text and lines; use the violet-tinted neutrals.
- **Don't** make dialogs translucent; they are solid.
