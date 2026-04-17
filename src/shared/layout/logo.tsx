import * as React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export function Logo({ size = 24, className, ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <circle cx="16" cy="18" r="1.8" fill="currentColor" opacity="0.2" />
      <path
        d="M16 24.25V18M16 18L11.3 13.3M16 18L20.7 13.3M16 18V10.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 10.75C16 8.35 17.85 6.4 20.15 6.4C20.15 8.8 18.3 10.75 16 10.75Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M11.25 13.2C11.25 10.95 9.45 9.1 7.25 9.1C7.25 11.35 9.05 13.2 11.25 13.2Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M20.75 13.2C20.75 10.95 22.55 9.1 24.75 9.1C24.75 11.35 22.95 13.2 20.75 13.2Z"
        fill="currentColor"
        opacity="0.14"
      />
      <circle cx="16" cy="10.7" r="1.25" stroke="currentColor" strokeWidth="1.15" opacity="0.72" />
      <circle cx="11.3" cy="13.3" r="1.25" stroke="currentColor" strokeWidth="1.15" opacity="0.62" />
      <circle cx="20.7" cy="13.3" r="1.25" stroke="currentColor" strokeWidth="1.15" opacity="0.62" />
    </svg>
  );
}
