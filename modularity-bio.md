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
<span style="color:#fff;font-weight:700">Yue</span> — EM / Pathos / Tempus AI (foundation models, 1,000 H200s)

Backed by Y Combinator

---

<!-- _class: dark -->
<!-- _paginate: false -->

## Our Vision

We build the **missing data layer** for the next generation of medicine — transforming sparse experimental data into complete predictions through computational biology.

---

<!-- _paginate: false -->

## What we can do for Modularity Bio

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### In Silico Screening

- **Receptor-ligand prediction models** — screen your 300+ receptor library computationally before committing to mouse studies
- **Signaling pathway modeling** — predict JAK2 and other pathway outputs from receptor configurations
- **Expression optimization** — model protein ratios and stoichiometry for multi-gene constructs

</div>
<div style="flex:1">

### Infrastructure & Optimization

- **Inference optimization** — we took CZI's VariantFormer from ~$93 to $1.50/sample
  63x faster · zero accuracy loss
- **GPU infrastructure** — deep expertise running large-scale molecular ML workloads
  H200s · B200s

</div>
</div>

<small style="margin-top:auto;color:#666">*We can work within your VPC or run on Strand AI compute and deliver the results.</small>

---

<!-- _paginate: false -->

## The Problem We Solve

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### Without Strand

- Test 300 receptors → 300 mouse experiments
- Months of iteration
- $$$$ per candidate

</div>
<div style="flex:1">

### With Strand

- Train on your existing paired data
- Screen computationally, validate top hits in vivo
- 10-100x fewer animal experiments

</div>
</div>

---

<!-- _class: dark -->
<!-- _paginate: false -->

## How It Works

1. **You share paired data** — receptor sequences + measured signaling outputs
2. **We build a predictive model** — trained on your proprietary data
3. **Screen in silico** — rank your 300 receptors by predicted efficacy
4. **Validate top candidates** — only run mouse studies on the best hits

Your data stays yours. Models can run in your infrastructure.
