import jsPDF from "jspdf";

export const exportSvg = (
  svgElement: SVGSVGElement,
  fileName: string
) => {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = svgElement.clientWidth;
    canvas.height = svgElement.clientHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const png = canvas.toDataURL("image/png");

    // Download PNG
    const a = document.createElement("a");
    a.href = png;
    a.download = `${fileName}.png`;
    a.click();

    // Download PDF
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(png, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`${fileName}.pdf`);

    URL.revokeObjectURL(url);
  };
  image.src = url;
};

export default exportSvg;
