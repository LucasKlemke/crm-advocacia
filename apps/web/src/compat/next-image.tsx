import type { CSSProperties, ComponentPropsWithRef } from "react";

export interface ImageProps
  extends Omit<ComponentPropsWithRef<"img">, "src" | "alt" | "width" | "height" | "loading"> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /** Cobre o container (que precisa ser position: relative/absolute), como no Image do Next. */
  fill?: boolean;
  /** Imagem acima da dobra: carrega de imediato e com prioridade alta. */
  priority?: boolean;
  sizes?: string;
  // Aceitos só por compatibilidade — sem otimizador de imagem fora do Next.
  quality?: number;
  unoptimized?: boolean;
  placeholder?: string;
}

const ESTILO_FILL: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

// O Vite não tem o otimizador do Image do Next: as artes do produto já são .webp em
// public/images, então um <img> com lazy loading e as mesmas props de layout basta.
export function Image({
  fill = false,
  priority = false,
  quality: _quality,
  unoptimized: _unoptimized,
  placeholder: _placeholder,
  style,
  ...props
}: ImageProps) {
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- `alt` vem de ...props (ImageProps o exige)
    <img
      {...props}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      style={fill ? { ...ESTILO_FILL, ...style } : style}
    />
  );
}

export default Image;
