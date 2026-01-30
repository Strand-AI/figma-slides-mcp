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

## We do biological imputation at scale

We build **cross-modal prediction models** from paired datasets — the same paradigm as your H&E → molecular work (AACR '23, medRxiv '24), but focused on **spatial protein** prediction.

---

<!-- _paginate: false -->

## H&E → mIF: virtual spatial proteomics

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### What we're training

- **H&E → 193-biomarker mIF** — pan-cancer virtual staining from paired tissue datasets
- **3.4M patches** — 50x larger than current SOTA training sets
- Predicts spatially resolved protein expression, not just slide-level labels

</div>
<div style="flex:1">

### Why this complements your work

- Your AACR framework imputes **genomic features** (ATAC-seq, CNV, RNA) from H&E embeddings
- We impute **protein-level spatial features** (mIF panels) — a different output modality from the same input
- Potential to extend your Virtual Human with a spatial proteomics layer

</div>
</div>

---

<!-- _paginate: false -->

## Inference optimization

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### Track record

- **CZI VariantFormer** — ~$93 → $1.50/sample
  63x faster · zero accuracy loss
- Deep expertise in large-scale Bio/ML workloads
  H200s · B200s

</div>
<div style="flex:1">

### For insitro

- Your data processing pipelines ingest live cell imaging, scRNA-seq, DNA-encoded libraries at scale
- We can profile and optimize your most expensive inference workloads with the same approach

</div>
</div>

<small style="margin-top:auto;color:#666">*We can work within your VPC or run on Strand AI compute and deliver the results.</small>
