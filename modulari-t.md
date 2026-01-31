---
marp: true
theme: strand
paginate: true
footer: "Strand AI  ·  Confidential"
---

<!-- _class: lead -->
<!-- _footer: "" -->
<!-- _paginate: false -->

![w:400](assets/logo-white.svg)

<span style="color:#fff;font-weight:700">Oded</span> — Enable Medicine (petabyte-scale spatial biology platform)
<span style="color:#fff;font-weight:700">Yue</span> — EM / Pathos / Tempus AI (foundation models, 1000 H200s)

Backed by Y Combinator

---

<!-- _class: dark -->
<!-- _paginate: false -->

## Our Vision

We build the **missing data layer** for the next generation of medicine — transforming sparse experimental data into complete predictions through computational biology.

---

<!-- _paginate: false -->
<style scoped>section { padding: 50px 70px; }</style>

## What we can do for Modulari-T

**Predict outcomes of your most expensive experiments in silico** — screen more candidates, fewer experiments, higher hit rates.

<div style="display:flex;gap:60px;margin-top:0">
<div style="flex:1">

### In Silico Prediction

- **Custom models** from your paired experimental data
- **Screen computationally** — rank candidates before wet lab
- **Higher hit rates** — focus on the most promising designs

</div>
<div style="flex:1">

### Infrastructure

- **Inference optimization** — 63x speedup on CZI's VariantFormer, $93 → $1.50/sample
- **GPU compute** — in-house H200s, B200s

</div>
</div>

<small style="color:#666;font-size:0.7em">*We can work within your VPC or on Strand compute.</small>

---

<!-- _paginate: false -->

## The Problem We Solve

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### Without Strand

- 300 candidates → 300 expensive experiments
- Months of iteration, low hit rate
- Hard to know what's worth measuring

</div>
<div style="flex:1">

### With Strand

- Train a model on your existing paired data
- Predict outcomes before running experiments
- Validate only the top candidates
- You now have in house ML! 

</div>
</div>

---

<!-- _class: dark -->
<!-- _paginate: false -->

## How It Works

1. **You share paired data** — inputs (sequences, designs) + measured outcomes
2. **We build a predictive model** — trained on your proprietary data
3. **Screen in silico** — rank candidates by predicted outcome
4. **Validate top hits** — run experiments only on the most promising candidates

We can work in your Cloud or ours and deliver the results to you.
