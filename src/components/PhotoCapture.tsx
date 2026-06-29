import { Camera, Image, X } from "lucide-react";
import { loadPhoto, removePhoto, storePhoto } from "../lib/photo-store";

export function PhotoCapture({ photos, onChange, required = false }: { photos: string[]; onChange: (photos: string[]) => void; required?: boolean }) {
  async function add(files: FileList | null) {
    if (!files?.length) return;
    const ids = [];
    for (const file of Array.from(files)) ids.push(await storePhoto(file));
    onChange([...photos, ...ids]);
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-400 bg-white px-3 text-sm font-medium">
          <Camera className="h-4 w-4" />
          {required ? "Camera required photo" : "Camera"}
          <input className="hidden" type="file" accept="image/*" capture="environment" multiple onChange={(event) => add(event.target.files)} />
        </label>
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-400 bg-white px-3 text-sm font-medium">
          <Image className="h-4 w-4" />
          Photo Library
          <input className="hidden" type="file" accept="image/*" multiple onChange={(event) => add(event.target.files)} />
        </label>
      </div>
      {photos.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((id) => (
            <div key={id} className="relative overflow-hidden rounded-md border bg-white">
              <img className="h-28 w-full object-cover" src={loadPhoto(id)} alt="" />
              <button
                type="button"
                className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-white/90"
                onClick={() => {
                  removePhoto(id);
                  onChange(photos.filter((photo) => photo !== id));
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
