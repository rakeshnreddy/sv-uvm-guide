/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement>;

const MdxImage = ({ alt, loading, ...rest }: Props) => {
  return <img alt={alt ?? ""} loading={loading ?? "lazy"} {...rest} />;
};

export default MdxImage;
