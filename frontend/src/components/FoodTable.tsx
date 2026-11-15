import type { Food } from "../types";
export function FoodTable({ foods }: { foods: Food[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Menu</th>
            <th>Kategori</th>
            <th>Estimasi besok</th>
            <th>Sumber</th>
          </tr>
        </thead>
        <tbody>
          {foods.map((f) => (
            <tr key={f.id}>
              <td>
                <div className="menu-cell">
                  <span>{f.emoji}</span>
                  <b>{f.name}</b>
                </div>
              </td>
              <td>{f.category}</td>
              <td>
                <b>{f.forecast}</b> porsi
              </td>
              <td>
                <span className="badge">Data demo</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
