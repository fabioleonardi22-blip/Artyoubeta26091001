// Choose sources for the assigned section instead of defaulting every section to schools.
export function sourcesForCategory(sources, category) {
  const types = category === "Dentro l'improv" ? ["technique"] : category === "Impro People" ? ["person"] : ["school"];
  return sources.filter(source => types.includes(source.type));
}

// Retry rejected subjects with explicit feedback; never weaken duplicate checks.
export async function proposeUnique({prompt, generate, validate, attempts = 3}) {
  const rejected = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const feedback = rejected.length ? `\nPROPOSTE GIÀ SCARTATE: ${JSON.stringify(rejected)}\nScegli un altro argomento e un taglio diverso, sempre documentati dalle fonti.` : "";
    const article = await generate(prompt + feedback);
    try {
      await validate(article);
      return article;
    } catch (error) {
      if (!/^(Articolo ripetuto:|Argomento già pubblicato:)/.test(error.message) || attempt === attempts - 1) throw error;
      rejected.push({title:article.title, reason:error.message});
    }
  }
}
