import { render } from "@testing-library/react";
import {
  CasosStatusDonutChartSkeleton,
  StatusStatCardsSkeleton,
} from "./dashboard-skeleton";

function skeletons(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="skeleton"]');
}

describe("StatusStatCardsSkeleton", () => {
  it("reserva um card por tipo de status do seed", () => {
    const { container } = render(<StatusStatCardsSkeleton />);

    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(6);
    expect(skeletons(container).length).toBeGreaterThan(0);
  });
});

describe("CasosStatusDonutChartSkeleton", () => {
  it("desenha o anel e uma linha de legenda por tipo de status", () => {
    const { container } = render(<CasosStatusDonutChartSkeleton />);

    expect(container.querySelectorAll("li")).toHaveLength(6);
    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
  });
});
