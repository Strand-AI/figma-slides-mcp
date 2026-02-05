/**
 * Example Strand AI Deck
 *
 * This shows the structure of a deck file. Copy this and modify to create your own.
 *
 * Run with: npm run pptx:dev
 * View at: http://localhost:3000
 * Presenter view: http://localhost:3000/present/_example
 */

const pptxgen = require('pptxgenjs');
const { COLORS, mermaid, titleSlide, contentSlide, bullets } = require('../scripts/pptx-helpers');

// Speaker notes for presenter view (exported for dev server)
module.exports.notes = [
  // Slide 1: Title
  `Welcome everyone. This is Strand AI.
   - Introduce yourself
   - Thank them for their time`,

  // Slide 2: The Problem
  `Key points for this slide:
   - Biology hasn't had its ChatGPT moment
   - Data fragmentation is the root cause
   - Most datasets only have 5-15 modalities out of 80+ needed`,

  // Slide 3: Our Solution
  `Our approach:
   - We predict missing modalities from existing ones
   - Validation is by downstream utility, not reconstruction loss
   - This is principled biological imputation`,

  // Slide 4: How It Works (diagram)
  `Walk through the pipeline:
   - Start with sparse patient data (typical clinical datasets)
   - Strand AI predicts missing modalities
   - Output complete multimodal profiles
   - These enable foundation model training
   - Ultimately accelerating drug discovery`,

  // Slide 5: Closing
  `Closing:
   - Thank them
   - Ask if there are questions
   - Share contact info: strandai.bio`,
];

module.exports.build = async (outputPath) => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'Strand AI';
  pres.title = 'Example Presentation';

  // ============================================
  // SLIDE 1: Title slide (Pthalo background)
  // ============================================
  let slide1 = pres.addSlide();
  slide1.background = { color: COLORS.pthalo };

  slide1.addImage({
    path: 'assets/logo-white.svg',
    x: 3.5, y: 1.5, w: 3, h: 1.5
  });

  slide1.addText('The Missing Data Layer\nfor Biology Foundation Models', {
    x: 0.5, y: 3.2, w: 9, h: 1.5,
    fontSize: 28, color: COLORS.white, align: 'center',
    fontFace: 'Arial'
  });

  slide1.addText('Confidential', {
    x: 0.5, y: 5.2, w: 9, h: 0.3,
    fontSize: 10, color: COLORS.ashBeigeDark, align: 'center'
  });

  // ============================================
  // SLIDE 2: Content slide (light background)
  // ============================================
  let slide2 = pres.addSlide();
  slide2.background = { color: COLORS.ashBeige };

  slide2.addText('The Problem', {
    x: 0.5, y: 0.4, w: 9, h: 0.8,
    fontSize: 36, color: COLORS.pthalo, bold: true,
    fontFace: 'Arial Black'
  });

  slide2.addText([
    { text: 'Biology data is sparse and fragmented', options: { bullet: true, breakLine: true } },
    { text: 'Most patient profiles capture only 5-15 modalities', options: { bullet: true, breakLine: true } },
    { text: '80+ modalities needed to understand human disease', options: { bullet: true, breakLine: true } },
    { text: 'Foundation models need complete data to train effectively', options: { bullet: true } },
  ], {
    x: 0.5, y: 1.5, w: 8.5, h: 3,
    fontSize: 18, color: COLORS.darkSlate,
    fontFace: 'Arial', valign: 'top'
  });

  // ============================================
  // SLIDE 3: Two-column layout
  // ============================================
  let slide3 = pres.addSlide();
  slide3.background = { color: COLORS.white };

  slide3.addText('Our Solution', {
    x: 0.5, y: 0.4, w: 9, h: 0.8,
    fontSize: 36, color: COLORS.pthalo, bold: true,
    fontFace: 'Arial Black'
  });

  // Left column
  slide3.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.4, w: 4.25, h: 3.5,
    fill: { color: COLORS.ashBeige },
  });

  slide3.addText('Multimodal Imputation', {
    x: 0.6, y: 1.5, w: 4, h: 0.5,
    fontSize: 20, color: COLORS.pthalo, bold: true
  });

  slide3.addText('Predict missing biological modalities from existing ones', {
    x: 0.6, y: 2.1, w: 4, h: 2.5,
    fontSize: 14, color: COLORS.darkSlate, valign: 'top'
  });

  // Right column
  slide3.addShape(pres.shapes.RECTANGLE, {
    x: 5.25, y: 1.4, w: 4.25, h: 3.5,
    fill: { color: COLORS.ashBeige },
  });

  slide3.addText('Validation by Utility', {
    x: 5.35, y: 1.5, w: 4, h: 0.5,
    fontSize: 20, color: COLORS.pthalo, bold: true
  });

  slide3.addText('Biomarker prediction, patient stratification, clinical outcomes', {
    x: 5.35, y: 2.1, w: 4, h: 2.5,
    fontSize: 14, color: COLORS.darkSlate, valign: 'top'
  });

  // ============================================
  // SLIDE 4: Mermaid diagram example
  // ============================================
  let slide4 = pres.addSlide();
  slide4.background = { color: COLORS.white };

  slide4.addText('How It Works', {
    x: 0.5, y: 0.4, w: 9, h: 0.8,
    fontSize: 36, color: COLORS.pthalo, bold: true,
    fontFace: 'Arial Black'
  });

  // Render mermaid diagram
  const diagram = await mermaid(`
    graph LR
      A[Sparse Patient Data] --> B[Strand AI]
      B --> C[Complete Profiles]
      C --> D[Foundation Models]
      D --> E[Drug Discovery]
  `);

  slide4.addImage({
    data: diagram,
    x: 0.5, y: 1.5, w: 9, h: 3.5
  });

  // ============================================
  // SLIDE 5: Closing slide (dark)
  // ============================================
  let slide5 = pres.addSlide();
  slide5.background = { color: COLORS.darkSlate };

  slide5.addImage({
    path: 'assets/logo-white.svg',
    x: 3.5, y: 2, w: 3, h: 1.5
  });

  slide5.addText('strandai.bio', {
    x: 0.5, y: 4, w: 9, h: 0.5,
    fontSize: 18, color: COLORS.ashBeigeDark, align: 'center'
  });

  // Write the file
  await pres.writeFile({ fileName: outputPath });
};
