import { BookIcon, CapIcon, MapPinIcon, SparkIcon } from "./icons";

const HIGHLIGHTS = [
  { icon: SparkIcon, label: "Dios, Patria, Ciencia" },
  { icon: BookIcon, label: "Preescolar a bachillerato" },
  { icon: CapIcon, label: "Educación en valores" },
  { icon: MapPinIcon, label: "Apopa, San Salvador" },
];

export function Stats() {
  return (
    <section className="border-b border-brand-100 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4">
        {HIGHLIGHTS.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <item.icon className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-brand-800">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
