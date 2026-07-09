interface NotFoundJoke {
  headline: string;
  punchline: string;
}

export const NOT_FOUND_JOKES: NotFoundJoke[] = [
  {
    headline: "Oops! Even Kṛṣṇa couldn't find this page.",
    punchline:
      "He probably knows where it is, but He isn't telling us.",
  },
  {
    headline: "Looks like this page has left the material world.",
    punchline:
      "It has attained liberation from the cycle of URLs. Let it be.",
  },
  {
    headline: "404 — Māyā has covered this page.",
    punchline:
      "She's powerful, but you can still break free. Try a different route.",
  },
  {
    headline: "This page has gone on pilgrimage.",
    punchline:
      "It's touring the 12 forests of Vraja. It'll be back in a few lifetimes.",
  },
  {
    headline:
      "This page has attained nitya-siddha status — it's eternally beyond our reach.",
    punchline: "Try a different route.",
  },
  {
    headline: "This page left its body.",
    punchline:
      "The funeral was held at the 404 Ghat. Offer some prasādam in its memory.",
  },
  {
    headline: "This page is on mauna-vrata.",
    punchline:
      "It's not speaking to anyone right now. Come back after maṅgala-ārātrika.",
  },
];

export function getRandomJoke(): NotFoundJoke {
  return NOT_FOUND_JOKES[Math.floor(Math.random() * NOT_FOUND_JOKES.length)];
}