---
marp: true
theme: strand
paginate: true
footer: "Strand AI  ·  Confidential"
---

<!-- _class: lead -->
<!-- _footer: "" -->
<!-- _paginate: false -->

# VariantFormer at Scale

### Strand AI × AstraZeneca

---

<!-- _paginate: false -->

## Hypothesis validation is bottlenecked by compute

<div style="display:flex;gap:60px;margin-top:20px">
<div style="flex:1">

### The challenge

Running VariantFormer at **biobank scale** takes weeks to months — making **iterative hypothesis testing impractical**

</div>
<div style="flex:1">

### What this blocks

- Rapid validation of gene-disease associations
- Exploring larger gene panels
- Scaling to UK Biobank cohort sizes

</div>
</div>

---

<!-- _paginate: false -->

## We turn months into days

**UK Biobank scale** (500k samples × 300 genes × 45 tissues)*

| | Time | Cost |
|--|------|------|
| **Strand** | ~1 week | **<$100k** |
| **DIY** | months | ~$2M |

<small style="color:#666">*Estimates based on current cloud pricing; subject to capacity and provider rates.</small>

<!--
- Strand estimate: 128× B200 on Lambda at $3.79/gpu/hr for ~5 days ≈ $58k
- DIY ~$2M estimate: assumes AZ upgrades to B200s (4-5x hardware speedup) but without code optimization
- Full exome (18k genes) scales proportionally (~60x cost)
-->
