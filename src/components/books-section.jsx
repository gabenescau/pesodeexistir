import { useMemo } from "react";
import { BookCarousel } from "@/components/book-carousel";

const bookFiles = [
  "025c0cbd3aaacddba658222d23bf08b1.jpg",
  "06207f0acc7bed7d6746d3769a2eeef9.jpg",
  "0ac2791ed41b24b6af02a6ce2b59c3e8.jpg",
  "13338329a18f9937d1b0d8e31ba331d7.jpg",
  "17246e96e1849a868b81412a2de0bcbc.jpg",
  "19ebdf73baa10690da782a6aa11963d8.jpg",
  "2b75a313d2d19715a08607605755de65.jpg",
  "33db30b17ed2cd2689fb9d1499f24d35.jpg",
  "492dd6edb0d27970532073b4a49676e4.jpg",
  "4c303e9cde79f07162a1a3afea67ffbb.jpg",
  "514cf55a57e44d2faa0242b2360c8c85.jpg",
  "61b995df8e8391ec4996bf635730553a.jpg",
  "643fc0cfb39b9624570c6329eac1c526.jpg",
  "6b6a0b7c58a7dea68d7da2ea366d333f.jpg",
  "71dd6bb529e2354386ad6c33775ca979.jpg",
  "777b07bba0c99aff29eec673c6def623.jpg",
  "78b4f7c49c9a30d66ae617cd370e01a8.jpg",
  "7b588ffbe648eaf7e8fdcabf27319532.jpg",
  "8af2c4ef88c48cb6e13e5f432a99e55f.jpg",
  "9026bb013b780e0b05a58dc7016b25c2.jpg",
  "a15e9087b9f40a227d70f848c75ae65d.jpg",
  "ab7e7691b6fee800b448afceb7ba0730.jpg",
  "b94729ae909f3f6b094cda21d9dd0c8c.jpg",
  "bcbbc0c4ff12008c55b70ffd2961ac92.jpg",
  "c3a046a4707576be05bae84a3374328d.jpg",
  "c6301b7f89305d46014c9d7ed455f79d.jpg",
  "d3ea2f6373830489305057f39748dc45.jpg",
  "d510724420b459d1e7e46ea7e3ef252d.jpg",
  "d580e313d815bf1c2c8d6c89826d9b3e.jpg",
  "dd76efcc53c0392d7e9ec004bc67efce.jpg",
];

export function BooksSection() {
  const images = useMemo(
    () => bookFiles.map((f) => `/livros/${f}`),
    []
  );

  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="px-4 md:px-8 mb-12">
        <div className="max-w-6xl mx-auto text-center">
          <span className="font-mono text-[12px] font-[400] text-muted-foreground uppercase tracking-[0.6px] mb-4 block">
            Os livros
          </span>
          <h2 className="text-[32px] md:text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-foreground">
            Uma biblioteca em constante
            <br />
            crescimento.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-[16px] font-[400] leading-[24px]">
            Arraste para explorar as capas. Clique em qualquer livro para ver em detalhes.
          </p>
        </div>
      </div>

      <BookCarousel images={images} />
    </section>
  );
}
