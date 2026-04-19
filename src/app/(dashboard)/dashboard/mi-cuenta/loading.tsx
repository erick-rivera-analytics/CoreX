import { Skeleton } from "@/shared/ui/skeleton";

export default function MyAccountLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-64 w-full rounded-[24px]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-[24px]" />
        <Skeleton className="h-80 w-full rounded-[24px]" />
      </div>
      <Skeleton className="h-48 w-full rounded-[24px]" />
    </div>
  );
}
