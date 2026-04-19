import { Skeleton } from "@/shared/ui/skeleton";

export default function MyWorkLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-72 w-full rounded-[24px]" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-40 w-full rounded-[24px]" />
        <Skeleton className="h-40 w-full rounded-[24px]" />
        <Skeleton className="h-40 w-full rounded-[24px]" />
      </div>
      <Skeleton className="h-[420px] w-full rounded-[24px]" />
      <Skeleton className="h-[360px] w-full rounded-[24px]" />
    </div>
  );
}
