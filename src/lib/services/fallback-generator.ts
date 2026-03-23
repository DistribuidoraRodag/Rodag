interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

type ImageFormat = "1080x1080" | "1080x1920" | "1200x628";

const FORMAT_MAP: Record<ImageFormat, { width: number; height: number }> = {
  "1080x1080": { width: 1080, height: 1080 },
  "1080x1920": { width: 1080, height: 1920 },
  "1200x628": { width: 1200, height: 628 },
};

export class FallbackGenerator {
  async generateFallbackImage(
    expectedText: Record<string, string>,
    brandColors: BrandColors = {
      primary: "#1a2e4a",
      secondary: "#ffffff",
      accent: "#f5a623",
    },
    format: ImageFormat = "1080x1080"
  ): Promise<string> {
    const { width, height } = FORMAT_MAP[format];
    return this.buildSVG(width, height, expectedText, brandColors);
  }

  private buildSVG(
    width: number,
    height: number,
    text: Record<string, string>,
    colors: BrandColors
  ): string {
    const headline = this.escapeXml(text.headline || text.product || "");
    const price = this.escapeXml(text.price || "");
    const cta = this.escapeXml(text.cta || text.cta_primary || "Solicite seu orçamento");
    const phone = this.escapeXml(text.phone || "");
    const body = this.escapeXml(text.body || "");

    const isVertical = height > width;
    const isHorizontal = width > height * 1.5;

    // Dynamic spacing based on format
    const centerY = Math.round(height * 0.35);
    const priceY = Math.round(height * (isVertical ? 0.48 : 0.52));
    const bodyY = Math.round(height * (isVertical ? 0.58 : 0.42));
    const ctaY = Math.round(height * (isVertical ? 0.72 : 0.7));
    const phoneY = Math.round(height * (isVertical ? 0.85 : 0.88));
    const logoY = Math.round(height * 0.95);

    const headlineFontSize = isHorizontal ? 48 : 56;
    const priceFontSize = isHorizontal ? 64 : 72;
    const ctaFontSize = isHorizontal ? 32 : 36;
    const bodyFontSize = isHorizontal ? 24 : 28;

    const ctaWidth = Math.min(width * 0.7, 600);
    const ctaHeight = 80;
    const ctaX = (width - ctaWidth) / 2;

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0d1b2a;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)" />

  <!-- Decorative line -->
  <rect x="${width * 0.1}" y="${centerY - 60}" width="${width * 0.8}" height="2" fill="${colors.accent}" opacity="0.4" />

  <!-- Headline -->
  <text x="${width / 2}" y="${centerY}" font-family="Arial, Helvetica, sans-serif" font-size="${headlineFontSize}" font-weight="bold" text-anchor="middle" fill="${colors.secondary}">
    ${headline}
  </text>

  <!-- Body -->
  ${body ? `<text x="${width / 2}" y="${bodyY}" font-family="Arial, Helvetica, sans-serif" font-size="${bodyFontSize}" text-anchor="middle" fill="${colors.secondary}" opacity="0.85">
    ${body.length > 60 ? body.substring(0, 57) + "..." : body}
  </text>` : ""}

  <!-- Price -->
  ${price ? `<text x="${width / 2}" y="${priceY}" font-family="Arial, Helvetica, sans-serif" font-size="${priceFontSize}" font-weight="bold" text-anchor="middle" fill="${colors.accent}">
    ${price}
  </text>` : ""}

  <!-- CTA Button -->
  <rect x="${ctaX}" y="${ctaY - ctaHeight / 2}" width="${ctaWidth}" height="${ctaHeight}" rx="12" fill="${colors.accent}" />
  <text x="${width / 2}" y="${ctaY + 12}" font-family="Arial, Helvetica, sans-serif" font-size="${ctaFontSize}" font-weight="bold" text-anchor="middle" fill="${colors.primary}">
    ${cta}
  </text>

  <!-- Phone -->
  ${phone ? `<text x="${width / 2}" y="${phoneY}" font-family="Arial, Helvetica, sans-serif" font-size="28" text-anchor="middle" fill="${colors.secondary}" opacity="0.7">
    ${phone}
  </text>` : ""}

  <!-- Decorative line bottom -->
  <rect x="${width * 0.1}" y="${logoY - 30}" width="${width * 0.8}" height="2" fill="${colors.accent}" opacity="0.4" />

  <!-- Logo text -->
  <text x="${width / 2}" y="${logoY}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="${colors.accent}" letter-spacing="6">
    RODAG
  </text>
</svg>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
