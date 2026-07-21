/* Shimmer skeleton components */

function SkeletonBase({ className = '' }) {
  return (
    <div className={`relative overflow-hidden surface-3 rounded-xl ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent" />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <SkeletonBase className="w-full aspect-square rounded-none" />
      <div className="p-4 space-y-2.5">
        <SkeletonBase className="h-3 w-full" />
        <SkeletonBase className="h-3 w-3/4" />
        <SkeletonBase className="h-5 w-1/2 mt-1" />
        <SkeletonBase className="h-8 w-full mt-2" />
      </div>
    </div>
  );
}

export function WishlistSkeleton() {
  return (
    <div className="card p-4 flex gap-4">
      <SkeletonBase className="w-24 h-24 shrink-0" />
      <div className="flex-1 space-y-2.5">
        <SkeletonBase className="h-3 w-full" />
        <SkeletonBase className="h-3 w-4/5" />
        <SkeletonBase className="h-5 w-1/3 mt-1" />
        <SkeletonBase className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function CommunityRowSkeleton() {
  return (
    <div className="card p-4 flex items-center gap-4">
      <SkeletonBase className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <SkeletonBase className="h-3 w-32" />
        <SkeletonBase className="h-2.5 w-20" />
      </div>
      <SkeletonBase className="h-5 w-20" />
    </div>
  );
}
