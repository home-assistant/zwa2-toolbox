
import Alert from './Alert';

export default function WebSerialWarning() {
  return (
    <Alert title="Your browser does not support Web Serial" severity="warning">
      <p>
        Open this page in Google Chrome or Microsoft Edge instead.
      </p>
    </Alert>
  );
}
