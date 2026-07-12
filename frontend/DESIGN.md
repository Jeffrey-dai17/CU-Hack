# Recipe Match — UI & Motion System

This document describes the design system, the shared components, and the motion
principles introduced for the swipe deck and the scrolling recipe pages. It also
records the non-obvious constraints that keep the flashy UI compatible with the
accessibility guarantees and the test suite.

## Goals

- **Bigger, friendlier controls.** The swipe deck's skip/like actions are large
  labeled pills with clear icons, generous tap targets, and a keyboard path.
- **A "startup-grade" scrolling experience.** The recipe detail and liked pages
  reveal content as you scroll, with staggered cards, hover shine, a sticky glass
  nav, and spring micro-interactions.
- **Zero accessibility regressions.** Everything honors
  `prefers-reduced-motion`, keeps visible focus states, and preserves the
  accessible names the app already exposed.

## Design tokens

All tokens live in `src/index.css` under `:root`. The additions layer a motion
system and interactive elevation on top of the existing brand palette.

| Token | Purpose |
| --- | --- |
| `--ease-out-expo`, `--ease-out-back`, `--ease-in-out-soft` | Shared easing curves. `back` overshoots slightly for a "spring" feel. |
| `--dur-fast` / `--dur-med` / `--dur-slow` | 140 / 260 / 460 ms timing scale. |
| `--shadow-press`, `--shadow-hover`, `--shadow-glow-green`, `--shadow-glow-coral` | Interactive elevation + colored glows. |
| `--gradient-green`, `--gradient-coral`, `--gradient-aurora` | Signature gradients for buttons, progress, and accents. |

### Shared keyframes

Defined once in `index.css` and reused everywhere: `rise-in`, `pop-in`,
`slide-in-left`, `float-y`, `shine-sweep`, `gradient-pan`, `pulse-ring`,
`live-dot-pulse`, plus the original `page-rise-in`.

> **jsdom-safe rule.** Every keyframe animates from a hidden state *to* the
> element's natural resting state (opacity 1, no transform). jsdom does not run
> CSS animations, so `getComputedStyle` reports the resting values. This keeps
> `toBeVisible()` assertions honest while real browsers still get the animation.

## Components

### `BrandLogo` (`src/components/BrandLogo.jsx`)

The supplied Dishly mark is the shared home affordance on the landing, deck,
liked-recipes, and detail views. It is served from
`public/images/dishly-logo-hero.png` as a tightly framed alpha-transparent
raster, so every surface uses the same complete, uncropped logo.

The mark is a real alpha-transparent PNG: there is no white badge, checkerboard,
or CSS mask behind it. Its rendered image is never clipped; only empty
transparent canvas was trimmed from the source. The detail nav uses a dark glass
surface so the light wordmark remains legible there too. The matching tab icon
contains only the fork-and-bowl mark, with no wordmark. Its home link has a
subtle lift/drop-shadow response on hover and press.

### `Button` (`src/components/Button.jsx`)

A single accessible, motion-powered control (shadcn-inspired variants, Framer
Motion press/hover springs).

```jsx
<Button variant="primary" size="lg" onClick={...}>Start swiping</Button>
<Button variant="secondary" size="sm" leftIcon={<BackGlyph />}>Back to deck</Button>
<Button busy>Saving</Button>            // spinner + aria-busy + blocked
<Button size="icon" aria-label="Skip" leftIcon={<X />} />
```

| Prop | Values | Default |
| --- | --- | --- |
| `variant` | `primary` \| `secondary` \| `ghost` \| `danger` | `primary` |
| `size` | `sm` \| `md` \| `lg` \| `icon` | `md` |
| `busy` | boolean — shows a spinner, sets `aria-busy`, blocks clicks | `false` |
| `leftIcon` | decorative node, rendered `aria-hidden` | — |
| `type`, `disabled`, `className`, `onClick`, … | forwarded to the button | — |

Motion preferences are handled globally by `<MotionConfig reducedMotion="user">`
in `App.jsx`, so `Button` has no per-instance reduced-motion branch — the springs
simply go quiet. Fully covered by `Button.test.jsx`.

## Page-level motion

### Landing prompt (`GoalEntryPage`)

- **Visual direction** - the opening screen is a prompt-first, dark culinary
  editorial. `public/images/recipe-match-hero.png` is deliberately framed so the
  input remains the first interaction and has uncluttered contrast behind it.
- **Motion** - Motion's variant orchestration stages brand, heading, prompt, and
  supporting controls. The image uses one low-amplitude transform-only idle
  drift; form focus, prompt chips, and the submit arrow use short hover/tap
  springs. Submission feedback remains immediate so loading and error state stay
  deterministic for assistive technology and form validation.
- **Return path** - the deck's explicit **Change goal** control carries a
  `returnTo: "/deck"` route state. Only that path exposes **Back to deck** on the
  landing page, leaving ordinary first visits intentionally uncluttered.

### Landing refinements

The landing screen is deliberately logo-first: the supplied Dishly mark is a large,
left-aligned lockup directly above the search module, while the search field carries the visible “What are you
craving?” prompt. The former large heading and supporting sentence are absent.

The search field owns the filters control. Its compact tune button opens a
full-width scale/fade/stagger popover with optional nutrition targets and quick
picks. The popover shares the search module's exact horizontal edges, making the two feel like one control. Every entered target is per serving and gets a 20% range. A valid
nutrition-only configuration is fully submittable and persists a generated goal
label without invoking goal parsing. Native number spinners are suppressed in
favour of the custom focus lift/glow. The dark input control owns the accessible
gold focus treatment, without a browser-white focus halo.

The landing rests slightly lower when filters are closed. Opening the popover
moves the complete logo-and-search group upward with a short easing, visually
centring the expanded interaction. On small screens the popover flows beneath
the input and the page scrolls instead of clipping it.

### Swipe deck (`SwipeDeckPage`)

- **Action pills** — `.deck-skip-button` / `.deck-like-button` are large
  (`min-height` 56–66px) labeled pills with an icon chip, gradient fills, colored
  glow on hover, a hover-only `pulse-ring`, and a Framer `whileTap` press.
- **Drag verdict stamps** — "Love it" / "Nope" stamps fade in via `useTransform`
  on the card's `x` motion value; the card's `box-shadow` also shifts green/coral
  with drag direction. Stamps are `aria-hidden` and clipped by the card.
- **Keyboard shortcuts** — `←` skips, `→` likes. Guarded against modifier keys and
  typing in form fields; the gesture UI stays clean without an instructional footer.
- **Progress** — an aurora-gradient progress bar plus a pulsing "live" dot.

### Recipe detail (`RecipeDetailPage`)

- **Scroll reveals** — the header, nutrition panel, written recipe, and footer use
  Framer `whileInView` (fade + rise, once). Diet chips stagger in.
- **Nutrition stats** — cards fade in with a stagger. See the containment note
  below for why they fade (opacity only) rather than transform.
- **Sticky glass nav**, hero image zoom-in, hover lift on recipe sections and diet
  chips, and an animated source-link arrow.

### Liked recipes (`LikedRecipesPage`)

- **Staggered grid** — each card animates in with `pop-in` and a per-card
  `animation-delay` (capped so large collections settle quickly). Driven by CSS
  keyframes because these tests assert `toBeVisible()` on card content.
- **Hover** — softly rounded image thumbnail, zoom + diagonal `shine-sweep` + lift.
- **Empty state** — a floating heart emblem.

### Route transitions and ambient motion

`App.jsx` uses Motion's `AnimatePresence` with a pathname key and `mode="wait"`.
Routes exit left before the next page enters from the right, so home, deck,
liked, and detail navigation all share one consistent transition. Route focus
management observes the transition container and focuses the incoming route only
after it has mounted. The liked grid then alternates its own left/right CSS
entrances, keeping its visibility tests stable.

The landing hero, deck, liked screen, and recipe detail background use the shared
`ambient-background` keyframe; the landing food image uses a separate, slightly
quicker transform-only drift. All ambient movement is disabled by the existing
reduced-motion rules.

The landing page's optional **Nutrition targets** control accepts whole-number
calorie, protein, and carbohydrate targets. Each entered number becomes a
per-serving range that is 20% above and below the target before the goal is
saved.

## Accessibility & reduced motion

- The global `@media (prefers-reduced-motion: reduce)` rule in `index.css`
  neutralizes all animation/transition durations. Each page additionally resets
  its hover transforms so nothing moves under reduced motion.
- All interactive elements keep the shared `:focus-visible` ring.
- Icon-only controls keep their `aria-label`s; visible pill labels ("Skip",
  "Like") are contained within those names (WCAG "label in name").

## Test-compatibility constraints (read before editing)

These are load-bearing. Breaking them breaks the suite.

1. **`toBeVisible()` fails on `opacity: 0`.** Never leave a Framer
   `initial={{ opacity: 0 }}` on an element a test marks visible. `LikedRecipesPage`
   tests check visibility → use CSS keyframes there. `RecipeDetailPage` tests do
   not → Framer `whileInView` is fine.
2. **Transformed elements change `scrollWidth`.** A `transform` (even from Framer)
   turns an element into a containing block, so Chromium counts overflowing
   content in `scrollWidth`. The giant-number containment e2e measures
   `.recipe-detail-stat` `scrollWidth`, so those cards animate with **opacity only**
   (`STAT_FADE`) and must stay `position: static`.
3. **Deck must fit 1366×768 with no page scroll.** The action pills grew, so the
   `.deck-card-stage` height budget (the `calc(100dvh - N)` constants per media
   query) was rebalanced. If you resize the actions, re-check the
   `min-width: 701px … max-height: 820px` query.
4. **No horizontal overflow at 320/390.** The hover `pulse-ring` scales only on
   hover (never at rest), so it adds no layout width during the overflow checks.
5. **Framer mock.** `SwipeDeckPage.test.jsx` mocks `framer-motion` with a generic
   proxy that strips motion-only props, so any `motion.*` / `AnimatePresence` works
   there. `src/test/setup.js` stubs `IntersectionObserver` (always intersecting) so
   `whileInView` reveals settle.

## Verification

```powershell
npm.cmd run lint            # oxlint, deny-warnings
npm.cmd run test:coverage   # coverage gates (85/80)
npm.cmd run build           # production bundle
npm.cmd run test:e2e        # Playwright (Edge)
```

Extreme provider numbers are constrained with a flex-safe ellipsis fallback.
Ordinary nutrition readings remain fully visible, while pathological values
cannot create internal or viewport overflow.
