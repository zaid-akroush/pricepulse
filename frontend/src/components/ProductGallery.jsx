import { useEffect, useState } from 'react';
import api from '../api/axios';
import ProductImage from './ProductImage';

/* A product used to show exactly one photo: whatever thumbnail the search
 * result happened to carry. That's often small, sometimes the wrong colour,
 * and occasionally broken. This pulls every image the backend could match to
 * the same product (see GET /products/:id/images) and shows them as a main
 * image plus a thumbnail strip.
 *
 * It degrades quietly: until the gallery request comes back — and forever, if
 * it fails or finds nothing extra — this renders exactly what the single-image
 * version rendered, so a slow or unavailable search provider never leaves the
 * page image-less.
 */
export default function ProductGallery({ product }) {
  const [images, setImages] = useState(product.imageUrl ? [product.imageUrl] : []);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    setImages(product.imageUrl ? [product.imageUrl] : []);
    setActive(0);
    api.get(`/products/${product.id}/images`)
      .then(r => {
        const found = r.data?.images || [];
        if (live && found.length > 0) {
          setImages(found);
          setActive(0);
        }
      })
      .catch(() => { /* keep the single stored image */ });
    return () => { live = false; };
  }, [product.id, product.imageUrl]);

  const current = images[active] ?? product.imageUrl;

  return (
    <div className="card p-6 flex flex-col gap-4">
      <div className="flex-1 flex items-center justify-center min-h-64">
        <ProductImage
          key={current || 'none'}
          src={current}
          alt={product.title}
          productId={product.id}
          className="max-h-64 w-full object-contain"
          fallbackClass="h-40 w-full"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Product photos">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${images.length}`}
              aria-current={i === active}
              className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-colors flex items-center justify-center surface"
              style={{ borderColor: i === active ? 'var(--brand)' : 'var(--border)' }}
            >
              <ProductImage
                src={src}
                alt=""
                className="w-full h-full object-contain"
                fallbackClass="w-full h-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
