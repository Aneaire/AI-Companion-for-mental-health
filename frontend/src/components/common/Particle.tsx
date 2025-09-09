import { useAutoAnimate } from "@formkit/auto-animate/react";

import { useEffect, useState } from "react";

const Particle = ({ style }: { style: React.CSSProperties }) => (
  <div
    className="absolute rounded-full opacity-50 pointer-events-none scale-200"
    style={style}
  />
);

// Particles background component
export const ParticlesBackground = () => {
  const [particles, setParticles] = useState<
    {
      id: number;
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
    }[]
  >([]);

  const [parent] = useAutoAnimate(); // 🔹 Initialize Auto Animate

  useEffect(() => {
    const createParticles = () => {
      const particlesCount = 100;
      const newParticles = [];

      for (let i = 0; i < particlesCount; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: Math.random() * 10 + 2,
          speedX: (Math.random() - 0.5) * 1,
          speedY: (Math.random() - 0.5) * 1,
          color: `rgba(${Math.floor(Math.random() * 50) + 200}, ${
            Math.floor(Math.random() * 50) + 200
          }, ${Math.floor(Math.random() * 100) + 155}, 0.8)`,
        });
      }

      setParticles(newParticles);
    };

    createParticles();

    const animateParticles = () => {
      setParticles((prevParticles) =>
        prevParticles.map((particle) => {
          let newX = particle.x + particle.speedX;
          let newY = particle.y + particle.speedY;

          if (newX <= 0 || newX >= window.innerWidth) {
            newX = Math.max(0, Math.min(newX, window.innerWidth));
            particle.speedX *= -1;
          }

          if (newY <= 0 || newY >= window.innerHeight) {
            newY = Math.max(0, Math.min(newY, window.innerHeight));
            particle.speedY *= -1;
          }

          return {
            ...particle,
            x: newX,
            y: newY,
          };
        })
      );
    };

    const animationId = setInterval(animateParticles, 30);

    const handleResize = () => {
      createParticles();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearInterval(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div ref={parent} className="fixed inset-0 z-0 overflow-hidden">
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            backgroundColor: particle.color,
            // transition: "left 0.3s ease-out, top 0.3s ease-out",
          }}
        />
      ))}
    </div>
  );
};

