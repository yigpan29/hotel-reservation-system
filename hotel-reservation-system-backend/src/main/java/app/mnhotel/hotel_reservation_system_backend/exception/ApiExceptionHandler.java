package app.mnhotel.hotel_reservation_system_backend.exception;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ApiException.class) ResponseEntity<?> domain(ApiException e){return ResponseEntity.status(e.getStatus()).body(Map.of("message",e.getMessage()));}
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException e){
        Map<String,String> fields=new LinkedHashMap<>();e.getBindingResult().getFieldErrors().forEach(f->fields.putIfAbsent(f.getField(),f.getDefaultMessage()));
        return ResponseEntity.badRequest().body(Map.of("message","Revisa los campos indicados","fields",fields));
    }
    @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> duplicate(){return ResponseEntity.status(409).body(Map.of("message","Los datos están duplicados o incumplen una restricción"));}
    @ExceptionHandler(BadCredentialsException.class) ResponseEntity<?> credentials(){return ResponseEntity.status(401).body(Map.of("message","Usuario o contraseña incorrectos"));}
    @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class}) ResponseEntity<?> malformed(){return ResponseEntity.badRequest().body(Map.of("message","Formato de solicitud inválido"));}
}
