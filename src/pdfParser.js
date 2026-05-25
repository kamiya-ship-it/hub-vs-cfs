const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const EXTRACTION_PROMPT = `Extract all line items from this commercial invoice or packing list. Return ONLY a JSON array (no markdown) like:
[{"sku":"product name","hs":"HS code or empty","pcs":0,"boxes":0,"kg":0,"lcm":0,"wcm":0,"hcm":0}]
Rules: sku=product description, hs=HS code or "", pcs=total pieces, boxes=number of cartons, kg=gross weight PER BOX (divide total gross by boxes), lcm/wcm/hcm=box dims in cm (convert from mm or inches if needed). Return only the JSON array.`;

async function parsePdf(filePath) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set. Add it to your .env file.');

  const client = new Anthropic({ apiKey });
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: EXTRACTION_PROMPT },
      ],
    }],
  });

  const text = response.content
    .map(c => c.text || '')
    .join('')
    .trim()
    .replace(/```json|```/g, '')
    .trim();

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('No line items found in PDF.');
  }

  return parsed.map(d => ({
    sku: d.sku || '',
    hs: d.hs || '',
    pcs: +d.pcs || 0,
    boxes: +d.boxes || 0,
    kg: +d.kg || 0,
    lcm: +d.lcm || 0,
    wcm: +d.wcm || 0,
    hcm: +d.hcm || 0,
  }));
}

module.exports = { parsePdf };
