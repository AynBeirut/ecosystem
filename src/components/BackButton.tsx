import { useNavigate } from "react-router-dom";

export default function BackButton() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(-1)}
      className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 flex items-center gap-2 mb-4"
      type="button"
    >
      <span aria-hidden="true">←</span> Back
    </button>
  );
}
