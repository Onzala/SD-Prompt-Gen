export const poseWearCollections = {
  pose: { group: '姿勢', label: '姿勢線稿', focus: 'body pose and camera angle' },
  depth: { group: '姿勢', label: '深度姿勢', focus: 'body pose, spatial depth and camera angle' },
  costume: { group: '服裝', label: '一般服裝', focus: 'clothing, accessories and garment colors' },
  anime: { group: '服裝', label: '動畫服裝', focus: 'clothing, accessories and garment colors' },
  dyn: { group: '服裝', label: '歷代服飾', focus: 'historical clothing, accessories and garment colors' },
  expr: { group: '表情', label: '表情', focus: 'facial expression and its intensity' },
  hair: { group: '髮型', label: '髮型', focus: 'hairstyle and hair color' },
} as const;

export type PoseWearCollection = keyof typeof poseWearCollections;
export type PoseWearGroup = typeof poseWearCollections[PoseWearCollection]['group'];

export interface PoseWearView {
  label?: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl: string;
}

export interface PoseWearItem {
  id: string;
  collection: PoseWearCollection;
  title: string;
  category?: string;
  description?: string;
  prompt: string;
  keywords?: string;
  sourceText?: string;
  adult?: boolean;
  views: PoseWearView[];
}

export interface PoseWearReference {
  id: string;
  collection: PoseWearCollection;
  title: string;
  adult?: boolean;
  prompt: string;
  view: PoseWearView;
}

export interface SelectedPoseWearReference {
  reference: PoseWearReference;
  replacement?: File;
}

export interface PromptImageReference {
  image: string;
  title: string;
  focus: string;
  description: string;
}

export const poseWearSource = ({ collection, id }: Pick<PoseWearReference, 'collection' | 'id'>) =>
  `https://posewear.pages.dev/#${collection}/${encodeURIComponent(id)}`;

export const referenceName = ({ title, view }: PoseWearReference) =>
  [title, view.label].filter(Boolean).join(' · ');

let catalog: Promise<PoseWearItem[]> | undefined;
export function loadPoseWearCatalog() {
  catalog ??= fetch(`${import.meta.env.BASE_URL}data/posewear.json`)
    .then(async response => {
      if (!response.ok) throw new Error('素材目錄載入失敗。');
      return await response.json() as PoseWearItem[];
    })
    .catch(error => {
      catalog = undefined;
      throw error;
    });
  return catalog;
}

export async function preparePoseWearReference(
  { reference, replacement }: SelectedPoseWearReference,
  signal: AbortSignal,
): Promise<PromptImageReference> {
  const title = referenceName(reference);
  const group = poseWearCollections[reference.collection];
  try {
    let image: Blob | undefined = replacement;
    if (!image) {
      const response = await fetch(reference.view.imageUrl, {
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      image = await response.blob();
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(image.type) || !image.size) {
      throw new Error('Unsupported reference image');
    }
    if (image.size > 4 * 1024 * 1024) {
      throw new Error('Reference image is larger than 4 MiB');
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(image);
    });
    signal.throwIfAborted();
    return {
      image: dataUrl,
      title,
      focus: group.focus,
      description: [reference.prompt, reference.view.description].filter(Boolean).join(', '),
    };
  } catch {
    signal.throwIfAborted();
    throw new Error(`無法讀取「${title}」的圖片。請在該素材下方手動附上 4 MB 以內的 JPG、PNG 或 WebP，或移除這筆素材後重試。`);
  }
}
