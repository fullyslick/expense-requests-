import { useParams } from 'react-router-dom';

export default function RequestDetail() {
  const { id } = useParams();

  return <h1>Request {id}</h1>;
}
