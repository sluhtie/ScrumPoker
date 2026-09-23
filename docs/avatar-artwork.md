# Avatar artwork

Six original cartoon avatars created with the built-in Imagegen tool (not the CLI). Final assets: `public/avatars/{fox,cat,ghost,robot,frog,axolotl}.webp`, optimized to 256 × 256 pixels for the picker and poker table. Assets are served locally; there are no third-party avatar requests or runtime generation calls.

The stable avatar ID is stored on the room member in PostgreSQL. The browser remembers the last choice for new rooms. Existing members without an avatar fall back to the fox. No database migration is necessary for the JSONB room data.

## Final prompts

### fox

Use case: stylized-concept. Asset: one original square cartoon profile avatar for Planning Club, a dark red scrum poker app. Discord-like gaming-community personality, original character design, premium bold 2D cartoon illustration with thick clean dark outlines, subtle cel shading, slightly exaggerated head, polished sticker-art feel. Centered head-and-shoulders close-up facing viewer, filling 78 percent of square. Every important part fits inside a centered circular crop with 10 percent margin. Flat full-bleed background, no outer border, no circle drawn, no text, no letters, no logos, no watermark, no poker cards, no photorealism, no 3D. Must remain immediately readable at 40 pixels. Cohesive chunky silhouette, playful expressive face. Character: a cheeky coral-orange fox wearing an oversized wine-red hoodie, cream muzzle, expressive eyebrows, one small ear piercing. Background: muted deep terracotta.

### cat

Use case: stylized-concept. Asset: one original square cartoon profile avatar for Planning Club, a dark red scrum poker app. Discord-like gaming-community personality, original character design, premium bold 2D cartoon illustration with thick clean dark outlines, subtle cel shading, slightly exaggerated head, polished sticker-art feel. Centered head-and-shoulders close-up facing viewer, filling 78 percent of square. Every important part fits inside a centered circular crop with 10 percent margin. Flat full-bleed background, no outer border, no circle drawn, no text, no letters, no logos, no watermark, no poker cards, no photorealism, no 3D. Must remain immediately readable at 40 pixels. Cohesive chunky silhouette, playful expressive face. Character: a cool midnight-purple cat with lilac muzzle, chunky red headphones, mischievous half-smile and large bright eyes. Background: muted lavender.

### ghost

Use case: stylized-concept. Asset: one original square cartoon profile avatar for Planning Club, a dark red scrum poker app. Discord-like gaming-community personality, original character design, premium bold 2D cartoon illustration with thick clean dark outlines, subtle cel shading, slightly exaggerated head, polished sticker-art feel. Centered head-and-shoulders close-up facing viewer, filling 78 percent of square. Every important part fits inside a centered circular crop with 10 percent margin. Flat full-bleed background, no outer border, no circle drawn, no text, no letters, no logos, no watermark, no poker cards, no photorealism, no 3D. Must remain immediately readable at 40 pixels. Cohesive chunky silhouette, playful expressive face. Character: a playful warm-white little ghost wearing a raspberry-red beanie tilted sideways, big dark oval eyes, small smiling mouth, tiny floating arms. Background: muted dusty rose.

### robot

Use case: stylized-concept. Asset: one original square cartoon profile avatar for Planning Club, a dark red scrum poker app. Discord-like gaming-community personality, original character design, premium bold 2D cartoon illustration with thick clean dark outlines, subtle cel shading, slightly exaggerated head, polished sticker-art feel. Centered head-and-shoulders close-up facing viewer, filling 78 percent of square. Every important part fits inside a centered circular crop with 10 percent margin. Flat full-bleed background, no outer border, no circle drawn, no text, no letters, no logos, no watermark, no poker cards, no photorealism, no 3D. Must remain immediately readable at 40 pixels. Cohesive chunky silhouette, playful expressive face. Character: a friendly round blue robot with navy faceplate, two expressive ivory LED eyes, tiny red antenna, chunky burgundy jacket collar. Background: muted slate blue.

### frog

Use case: stylized-concept. Asset: one original square cartoon profile avatar for Planning Club, a dark red scrum poker app. Discord-like gaming-community personality, original character design, premium bold 2D cartoon illustration with thick clean dark outlines, subtle cel shading, slightly exaggerated head, polished sticker-art feel. Centered head-and-shoulders close-up facing viewer, filling 78 percent of square. Every important part fits inside a centered circular crop with 10 percent margin. Flat full-bleed background, no outer border, no circle drawn, no text, no letters, no logos, no watermark, no poker cards, no photorealism, no 3D. Must remain immediately readable at 40 pixels. Cohesive chunky silhouette, playful expressive face. Character: a laid-back mint-teal frog with large expressive eyes wearing a burgundy bucket hat and dark red hoodie, confident relaxed smile. Background: muted teal.

### axolotl

Use case: stylized-concept. Asset: one original square cartoon profile avatar for Planning Club, a dark red scrum poker app. Discord-like gaming-community personality, original character design, premium bold 2D cartoon illustration with thick clean dark outlines, subtle cel shading, slightly exaggerated head, polished sticker-art feel. Centered head-and-shoulders close-up facing viewer, filling 78 percent of square. Every important part fits inside a centered circular crop with 10 percent margin. Flat full-bleed background, no outer border, no circle drawn, no text, no letters, no logos, no watermark, no poker cards, no photorealism, no 3D. Must remain immediately readable at 40 pixels. Cohesive chunky silhouette, playful expressive face. Character: an adorable peach-pink axolotl with raspberry external gills, tiny freckles, big dark shiny eyes, oversized burgundy sweater collar. Background: muted plum.

