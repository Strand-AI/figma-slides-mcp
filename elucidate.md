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

## Strand AI x Elucidate Bio

<span style="color:#D9D1BB">Virtual spatial omics at scale</span>

<span style="color:#D9D1BB;margin-top:40px;display:block">Backed by Y Combinator (W26)</span>

---

<!-- _class: dark -->
<!-- _paginate: false -->

## Recap: what you told us you need

- **H&E → proteomics** (primary) and **H&E → transcriptomics** (secondary)
- Impute missing proteins onto your proteomic stack from IHC on serial sections
- Longer term: **predict any missing modality** from the other two (H&E, proteomics, transcriptomics)
- Correlations **> 0.8** — current published methods aren't there
- Validation against **patient outcomes**, not just reconstruction loss

The throughput bottleneck: spatial omics assays cost **$5-10K+ per slide** and take days. You can't run them on every sample.

---

<!-- _paginate: false -->

## We looked into S2-omics & GHIST

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### Where they fall short

- **S2-omics** — right idea (minimize assay cost), but doesn't scale beyond a few samples and cell-type accuracy tops out at 76%
- **GHIST** — 2020-era UNet 3+ backbone, published PCC of **0.27 on top SVGs** — far below your 0.8 threshold
- Neither was trained on data that looks like yours

</div>
<div style="flex:1">

### How we close the gap

- **Modern architectures** tailored to your needs — proteomic stack, gene expression, patient selection
- **Trained on your paired data** — your indications, your tissue types

</div>
</div>

---

<!-- _class: dark -->
<!-- _paginate: false -->

## The first step: H&E → mIF

Your paired data + our ML and compute expertise = **accelerate past SOTA**.
We're already training the first cross-modal bridge.

---

<!-- _paginate: false -->

## POSTMAN: largest paired H&E to mIF prediction model

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

| Metric | Scope |
|--------|---------|
| Patches | **3.45M** (224x224) |
| Biomarkers | **193 unique** |
| Regions | 18,576 |
| Total size | **7.5 TB** |

</div>
<div style="flex:1">

### vs. published methods

- **5x more patches** than HEX (Nature Medicine, 2026)
- **9x more biomarkers** than GigaTIME (Cell, 2026)
- **4x more biomarkers** than ROSIE (Nature Comms, 2025)
- Pan-cancer, multi-site training data

</div>
</div>

---

<!-- _paginate: false -->

## Biomarker coverage across 193 markers

![w:900](assets/postman-biomarker-coverage.png)

---

<!-- _paginate: false -->

## Early reconstruction results

![h:550](assets/postman-reconstruction.png)

---

<!-- _paginate: false -->

## The cost equation changes entirely

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### Today

- Spatial proteomics (mIF): **~$5K-10K/slide**
- Spatial transcriptomics: **~$5K-7K/slide**
- Days of lab time per assay
- You can profile dozens to hundreds of patients — not thousands

</div>
<div style="flex:1">

### With virtual staining

- Run the expensive assay on a **small subset** of paired samples
- Fine-tune POSTMAN on that paired data
- Predict **193 biomarkers** across your entire H&E archive at **GPU inference cost**
- Scale from hundreds to **thousands of patients** for the same budget

</div>
</div>

---

<!-- _paginate: false -->

## Why POSTMAN matters for Elucidate

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### Pan-cancer foundation

- Already predicts **193 spatially resolved biomarkers** from H&E
- Covers immune, structural, and functional markers
- **3.45M training patches** — largest paired dataset in the field

</div>
<div style="flex:1">

### Fine-tuned on your data

- We fine-tune on **your paired H&E + proteomics** to exceed published SOTA on your indications
- Your proprietary multimodal data = your **competitive moat**
- Different cancer types, different protein classes — handled by fine-tuning

</div>
</div>

---

<!-- _paginate: false -->

## H&E → spatial transcriptomics: same playbook

The same cost-reduction strategy applies to transcriptomics:

- Run spatial transcriptomics on a **small paired subset** (~$5-7K/slide)
- Train a custom model on that paired data using modern foundation model backbones
- Predict **gene expression across your full H&E archive** — no more $7K per slide
- We bring the **architecture, GPUs, and training expertise** — you bring the biology

<small style="margin-top:auto;color:#666">*The S2-omics approach (learn from a small paired region, predict the rest) but trained on your data, your indications, and pushed past their published benchmarks.</small>

---

<!-- _class: beige -->
<!-- _paginate: false -->

## What a design partnership looks like

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### You provide

- Paired H&E + proteomics data (priority indication)
- Go/no-go correlation thresholds
- Priority protein targets
- Success criteria

</div>
<div style="flex:1">

### We deliver

- **Fine-tuned POSTMAN** on your paired data
- Per-protein correlation coefficients
- Morphological interpretability per prediction
- Deployable on your infrastructure or ours

</div>
</div>

---

<!-- _class: dark -->
<!-- _paginate: false -->

## Why Strand AI

- **193-biomarker pan-cancer model** on the largest paired dataset in the field
- Building this in-house means assembling an ML team, sourcing GPUs, curating paired datasets, and iterating on architectures — **or you work with us** and skip all of that
- Fine-tuning on your data = **your competitive moat**, not ours
- **YC W26** — we're only taking 2-3 design partnerships to ensure we can focus on our partners

---

<!-- _class: lead -->
<!-- _footer: "" -->
<!-- _paginate: false -->

![w:300](assets/logo-white.svg)

### Next step: scope the POC with Jason

<span style="color:#D9D1BB">oded@strandai.bio · yue@strandai.bio</span>
