import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },

  webpack(config) {
    // Remove loaders padrão do Next que tratam SVG como componente React
    config.module.rules = config.module.rules.map((rule: any) => {
      if (
        typeof rule.test !== "undefined" &&
        rule.test instanceof RegExp &&
        rule.test.test(".svg")
      ) {
        return { ...rule, exclude: /\.svg$/i };
      }
      return rule;
    });

    // Força svg como arquivo estático
    config.module.rules.push({
      test: /\.svg$/i,
      type: "asset/resource",
    });

    return config;
  },
};

export default nextConfig;
