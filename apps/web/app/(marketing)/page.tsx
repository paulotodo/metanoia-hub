import type { Metadata } from 'next';
import { HeroSection } from '../../src/components/marketing/hero-section';
import { FeatureBlocks } from '../../src/components/marketing/feature-blocks';
import { PersonaBlocks } from '../../src/components/marketing/persona-blocks';

const pageTitle = 'Tecnologia que devolve o pastor ao rebanho';
const pageDescription =
  'Uma plataforma pensada para igrejas que querem cuidar das suas pessoas sem se perder em planilhas.';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: '/',
  },
  twitter: {
    title: pageTitle,
    description: pageDescription,
  },
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeatureBlocks />
      <PersonaBlocks />
    </>
  );
}
