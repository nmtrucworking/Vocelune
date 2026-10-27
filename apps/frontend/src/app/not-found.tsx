import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-canvas flex flex-col items-center justify-center p-4 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-brand-primarySoft text-brand-primary flex items-center justify-center font-bold text-xl">
        404
      </div>
      <h2 className="text-2xl font-bold text-brand-ink">Trang không tồn tại</h2>
      <p className="text-xs text-text-secondary max-w-sm">
        Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển.
      </p>
      <Link
        href="/app/dashboard"
        className="px-4 py-2 bg-brand-primary text-white rounded-control text-xs font-semibold hover:bg-brand-primaryHover transition-colors shadow-xs"
      >
        Trở về Tổng quan
      </Link>
    </div>
  );
}
