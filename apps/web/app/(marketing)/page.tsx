import type { Metadata } from 'next';
import { HeroSection } from '../../src/components/marketing/hero-section';
import { FeatureBlocks } from '../../src/components/marketing/feature-blocks';
import { PersonaBlocks } from '../../src/components/marketing/persona-blocks';

export const metadata: Metadata = {
  title: 'Tecnologia que devolve o pastor ao rebanho',
  description:
    'Uma plataforma pensada para igrejas que querem cuidar das suas pessoas sem se perder em planilhas.',
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
