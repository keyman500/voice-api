import { cn } from "@/lib/utils"

type VoiceApiLogoMarkProps = {
  className?: string
}

export function VoiceApiLogoMark({ className }: VoiceApiLogoMarkProps) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path
        d="M17.3379 23.9623C17.362 21.479 16.7376 19.4595 15.9433 19.4517C15.1491 19.4439 14.4857 21.4507 14.4616 23.9339C14.4375 26.4172 15.0619 28.4367 15.8561 28.4445C16.6504 28.4524 17.3138 26.4456 17.3379 23.9623Z"
        fill="currentColor"
      />
      <path
        d="M12.7345 23.3982C14.0864 21.3222 14.644 19.283 13.9801 18.8434C13.3161 18.4038 11.682 19.7303 10.3301 21.8062C8.97828 23.8821 8.42065 25.9213 9.08459 26.361C9.74858 26.8006 11.3827 25.4741 12.7345 23.3982Z"
        fill="currentColor"
      />
      <path
        d="M9.15449 20.4199C11.4049 19.4106 12.9674 17.9992 12.6446 17.2674C12.3218 16.5356 10.2358 16.7606 7.98546 17.7699C5.73511 18.7792 4.17254 20.1906 4.49536 20.9224C4.81818 21.6542 6.90414 21.4292 9.15449 20.4199Z"
        fill="currentColor"
      />
      <path
        d="M14.9928 12.2264C15.7571 12.0084 15.833 9.89441 15.1624 7.50483C14.4919 5.11524 13.3286 3.35487 12.5643 3.57295C11.8 3.79102 11.7241 5.90494 12.3947 8.29456C13.0653 10.6841 14.2285 12.4445 14.9928 12.2264Z"
        fill="currentColor"
      />
      <path
        d="M19.7209 8.37005C20.4382 5.99425 20.4036 3.87922 19.6437 3.64599C18.8838 3.41276 17.6864 5.14965 16.9692 7.52545C16.252 9.90123 16.2866 12.0163 17.0465 12.2495C17.8063 12.4827 19.0038 10.7458 19.7209 8.37005Z"
        fill="currentColor"
      />
      <path
        opacity="0.9"
        d="M23.0965 11.5795C24.9736 9.97155 26.0783 8.17328 25.564 7.56293C25.0497 6.95255 23.1112 7.76123 21.2342 9.36908C19.3572 10.977 18.2525 12.7753 18.7668 13.3856C19.281 13.996 21.2196 13.1874 23.0965 11.5795Z"
        fill="currentColor"
      />
      <path
        opacity="0.8"
        d="M24.2088 16.1221C26.65 15.7928 28.5436 14.8823 28.4382 14.0884C28.3329 13.2946 26.2686 12.9181 23.8274 13.2473C21.3862 13.5766 19.4926 14.4871 19.5979 15.281C19.7033 16.0748 21.7676 16.4514 24.2088 16.1221Z"
        fill="currentColor"
      />
    </svg>
  )
}

type VoiceApiLogoProps = {
  className?: string
}

export function VoiceApiLogo({ className }: VoiceApiLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap text-base font-semibold tracking-tight",
        className
      )}
    >
      <VoiceApiLogoMark className="size-7" />
      Voice API
    </span>
  )
}
